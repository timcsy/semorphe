/**
 * **探針：Cella 的 DAP 工作階段，一步要多少錢**（spec 183 plan 的 R1）。
 *
 * 控制器今天是「直譯器每走一步回呼宿主、宿主決定停不停」，逐步模式還先錄完整條軌跡再重播。
 * DAP 是「宿主下指令」。要不要保留回呼模型，取決於「每一步一次 stepIn」在一般課文程式上要多久。
 *
 * 只在 `CELLA_DAP_PROBE=1` 時跑（編譯 DAP 模組要幾十秒，不進 `npm test`）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Parser, Language } from 'web-tree-sitter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { createTestLifter } from '../helpers/setup-lifter'
import { formalize } from '../../src/providers/cella/formalize'
import type { SemanticNode } from '../../src/core/types'

const RUN = process.env.CELLA_DAP_PROBE === '1'
const read = (pkg: string | null, file: string): Uint8Array =>
  fs.readFileSync(path.join('node_modules', pkg === null ? 'cella-lang' : `@cella-lang/${pkg}`, file))

const DEBUGGER = `import cfamily.syntax
import cpp
def load (source : String) : cpp.Session := cpp.load source
def run (kind : Nat) (breakpoints : String) (closed : Nat) (fuel : Nat) (x : cpp.Session) : cpp.Stopping := cpp.run kind breakpoints closed fuel x
def stopConf (x : cpp.Session) (s : cpp.Stopping) : cpp.Session := cpp.stopConf x s
def stopKind (s : cpp.Stopping) : Nat := cpp.stopKind s
def stopNode (s : cpp.Stopping) : String := cpp.stopNode s
def stopOut (s : cpp.Stopping) : String := cpp.stopOut s
def stopErr (s : cpp.Stopping) : String := cpp.stopErr s
def stopDetail (s : cpp.Stopping) : String := cpp.stopDetail s
def divergences (s : cpp.Stopping) : String := cpp.divergences s
def feed (text : String) (x : cpp.Session) : cpp.Session := cpp.feed text x
def globals (x : cpp.Session) : String := cpp.globals x
def frames (at : String) (x : cpp.Session) : String := cpp.frames at x
def setVarErr (n : Nat) (x : cfamily.DeclId) (text : String) (s : cpp.Session) : String := cpp.setVarErr n x text s
def setVarConf (n : Nat) (x : cfamily.DeclId) (text : String) (s : cpp.Session) : cpp.Session := cpp.setVarConf n x text s
def env (x : cpp.Session) : String := cpp.env x
`

let bytes: Uint8Array
let lift: (code: string) => SemanticNode
beforeAll(async () => {
  if (!RUN) return
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  const parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
  lift = (code) => createTestLifter().lift(parser.parse(code)!.rootNode as never) as SemanticNode
  const cella = await import('cella-lang')
  await cella.default({ module_or_path: read(null, 'cella_bg.wasm') })
  cella.init_stdlib_explicit(read(null, 'stdlib.cell'))
  const loaded = new Set<string>()
  const lp = (name: string): void => {
    if (loaded.has(name)) return
    const it = new TextDecoder().decode(read(name, 'index.json'))
    const ix = JSON.parse(it)
    for (const m of ix.requires['cella-lang'].modules) if (!loaded.has('m:' + m)) { cella.load_module_pack(read(null, `modules/${m}.cell`)); loaded.add('m:' + m) }
    for (const p of ix.requires.packages ?? []) lp(p)
    for (const m of ix.modules[name].deps) { const r = JSON.parse(cella.load_library_pack(it, m, read(name, `${m}.cell`))); if (!r.ok) throw new Error(m + r.error) }
    loaded.add(name)
  }
  lp('cpp')
  const { DAP_EXPORTS } = await import('cella-lang/dap' as string)
  const t = Date.now()
  bytes = cella.compile_wasm_library(DEBUGGER, (DAP_EXPORTS as string[]).map((e) => (e === 'init' ? 'load' : e)).concat(['divergences']).join(','))
  console.log(`DAP 模組編譯 ${Date.now() - t} ms、${bytes.length} bytes`)
}, 300_000)

describe.skipIf(!RUN)('Cella DAP：一步的成本', () => {
  it('★ 量：課文規模的迴圈，每一步 stepIn 的時間、跑到底的時間、變數讀不讀得到', async () => {
    const { createSession } = await import('cella-lang/dap' as string)
    const tree = lift('#include <iostream>\nusing namespace std;\nint main() {\n  int s = 0;\n  for (int i = 0; i < 50; i++) {\n    s = s + i;\n  }\n  cout << s << endl;\n  return 0;\n}\n')
    const f = formalize(tree)
    expect(f.program, '翻不出來 → 量的是空氣').toBeTruthy()

    // ① 單步走到底
    const s1 = await createSession(bytes, { program: JSON.stringify(f.program) })
    let out = ''
    let ended = false
    s1.onEvent((ev: string, body: { output?: string }) => { if (ev === 'output') out += body.output ?? ''; if (ev === 'terminated') ended = true })
    let t = performance.now()
    await s1.launch({ stopOnEntry: true })
    let steps = 0
    const nodes = new Set<string>()
    let sawVars = 0
    while (!ended && steps < 5000) {
      await s1.stepIn(); steps++
      if (s1.node) nodes.add(s1.node)
      if (steps % 25 === 0 && !ended) sawVars = s1.variables(0).length
    }
    const stepMs = performance.now() - t
    console.log(`單步：${steps} 步、${stepMs.toFixed(0)} ms（每步 ${(stepMs / steps).toFixed(2)} ms）、經過 ${nodes.size} 顆節點、變數 ${sawVars} 個、輸出 ${JSON.stringify(out)}`)

    // ② 一次跑到底
    const s2 = await createSession(bytes, { program: JSON.stringify(f.program) })
    let out2 = ''
    s2.onEvent((ev: string, body: { output?: string }) => { if (ev === 'output') out2 += body.output ?? '' })
    t = performance.now()
    await s2.launch({ stopOnEntry: false })
    console.log(`跑到底：${(performance.now() - t).toFixed(0)} ms、輸出 ${JSON.stringify(out2)}`)

    // ③ 節點標籤能不能對回語義樹（每步的 node 都要歸得到某一顆）
    const ids = new Set<string>()
    const walk = (n: SemanticNode): void => { ids.add(n.id); for (const k of Object.values(n.slots ?? {})) k.forEach(walk) }
    walk(tree)
    const stray = [...nodes].filter((n) => !ids.has(n.split(/[/#]/)[0]))
    console.log(`對不回語義樹的停點：${stray.length}／${nodes.size}`, stray.slice(0, 5))
    expect(out2).toBe('1225\n')
  }, 300_000)
})
