/**
 * **執行工作階段的契約**（spec 183 T002）——每個宣告了 `session` 的提供者都跑同一組。
 *
 * 形狀照 DAP（`core/capabilities.ts` 的 `ExecutionSession`）：宿主下指令，每個指令回 `Outcome`。
 * 控制器只靠這一組行為；一個提供者過不了其中一條，控制器在那條路上就會壞。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { createTestLifter } from '../helpers/setup-lifter'
import fs from 'node:fs'
import path from 'node:path'
import { jsInterpreterProvider } from '../../src/providers/js-interpreter'
import { createCellaProvider } from '../../src/providers/cella/provider'
import { SessionStop, type ExecutionSession, type Provider } from '../../src/core/capabilities'
import type { SemanticNode } from '../../src/core/types'
import { liftPython } from '../helpers/python-lift'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})

/**
 * **Cella 提供者，worker 原地跑**——不 mock 判決或工作階段：`worker.ts` 在這個行程裡載入，
 * `fetch` 讀 `node_modules` 的檔（`?url` 在 vitest 裡是 `/node_modules/...`），沒有 IndexedDB 就每次編（快取的失敗路徑）。
 */
async function cellaInProcess(): Promise<Provider> {
  const g = globalThis as unknown as { self?: { postMessage(m: unknown): void; onmessage?: (e: { data: unknown }) => void }; fetch: typeof fetch }
  const toMain: { onmessage: ((e: { data: unknown }) => void) | null; onerror: null; postMessage(m: unknown): void } = {
    onmessage: null, onerror: null,
    postMessage: (m) => queueMicrotask(() => g.self!.onmessage!({ data: m })),
  }
  g.self = { postMessage: (m) => queueMicrotask(() => toMain.onmessage?.({ data: m })) }
  const realFetch = g.fetch
  g.fetch = (async (url: string) => {
    const u = String(url)
    // `?url` 在 vitest 裡是 `/node_modules/...`；node_modules 是符號連結（worktree）時是 `/@fs/<絕對路徑>`
    const file = u.startsWith('/@fs/') ? u.slice(4) : u.startsWith('/node_modules/') ? path.join(process.cwd(), u) : null
    if (!file) return realFetch(url)
    const bytes = fs.readFileSync(file.replace(/\?.*$/, ''))
    return { ok: true, status: 200, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) }
  }) as never
  await import('../../src/providers/cella/worker')
  const p = createCellaProvider(() => toMain as unknown as Worker)
  p.warmUp!()
  await until(() => p.readiness!().state === 'ready', 180_000)
  // 第一次 createSession 會讓 worker 開始編除錯模組（R4）；編好之前它不接
  const tree = lift(LOOP)
  await until(() => !('declined' in p.createSession!({ maxSteps: 1, formal: formalOf(tree) }, tree)), 180_000)
  return p
}

async function until(ok: () => boolean, ms: number): Promise<void> {
  const t = Date.now()
  while (!ok()) {
    if (Date.now() - t > ms) throw new Error('等不到')
    await new Promise((r) => setTimeout(r, 200))
  }
}

const formalOf = (tree: SemanticNode) => ({ tree, targetId: 'cpp', styleId: 'apcs', skeletonId: 'main' })
const lift = (c: string): SemanticNode => createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode
const find = (t: SemanticNode, pred: (n: SemanticNode) => boolean): SemanticNode | undefined => {
  if (pred(t)) return t
  for (const k of Object.values(t.slots ?? {})) for (const c of k) { const r = find(c, pred); if (r) return r }
  return undefined
}

let cellaShared: Promise<Provider> | null = null

const PROVIDERS: { id: string; make: () => Provider | Promise<Provider> }[] = [
  { id: 'js-interpreter', make: () => jsInterpreterProvider },
  // ⚠️ 同一個行程裡只能有一個模擬的 worker——C++ 與 Python 兩組共用同一個提供者
  { id: 'cella', make: () => (cellaShared ??= cellaInProcess()) },
]

function open(p: Provider, tree: SemanticNode): { s: ExecutionSession; out: () => string } {
  const s = p.createSession!({ maxSteps: 1_000_000, formal: formalOf(tree) }, tree)
  if ('declined' in s) throw new Error(`${p.id} 不接：${s.declined}`)
  let text = ''
  s.onOutput((t) => { text += t })
  return { s, out: () => text }
}

const LOOP = '#include <iostream>\nusing namespace std;\nint main() {\n  int s = 0;\n  for (int i = 0; i < 4; i++) {\n    s = s + i;\n  }\n  cout << s << endl;\n  return 0;\n}\n'
const READ = '#include <iostream>\nusing namespace std;\nint main() {\n  int n;\n  cin >> n;\n  cout << n * 2 << endl;\n  return 0;\n}\n'
const DIV0 = '#include <iostream>\nusing namespace std;\nint main() {\n  int a = 1;\n  int b = 0;\n  cout << a / b << endl;\n  return 0;\n}\n'

for (const entry of PROVIDERS) {
  describe(`執行工作階段的契約：${entry.id}`, () => {
    let p: Provider
    beforeAll(async () => { p = await entry.make() }, 400_000)

    it('★ 沒有中斷點：launch 一路跑完，輸出正確', async () => {
      const tree = lift(LOOP)
      const { s, out } = open(p, tree)
      expect(await s.launch(tree, { stopOnEntry: false })).toEqual({ kind: 'ended' })
      expect(out()).toBe('6\n')
    })

    it('★ 中斷點：停在那一顆、看得到變數；continue 跑完', async () => {
      const tree = lift(LOOP)
      const target = find(tree, (n) => n.componentId === 'cpp:print')!
      const { s, out } = open(p, tree)
      s.setBreakpoints([target.id])
      const o = await s.launch(tree, { stopOnEntry: false })
      expect(o).toMatchObject({ kind: 'stopped', stop: { reason: 'breakpoint', nodeId: target.id } })
      expect(s.variables().find((v) => v.name === 's')?.value, '🔴 停下來而變數面板是空的').toBe('6')
      expect(s.environment(), '不是板子上的程式 ⟹ 沒有板子狀態（spec 185）').toBeNull()
      expect(await s.continue()).toEqual({ kind: 'ended' })
      expect(out()).toBe('6\n')
    })

    it('🔴 中斷點設在運算式敘述（函式呼叫）上：會停、回報的是語義樹的 id（Cella 那側的標籤是 `<id>/stmt`）', async () => {
      const tree = lift('#include <iostream>\nusing namespace std;\nvoid f() {\n  cout << 1;\n}\nint main() {\n  int x = 2;\n  f();\n  cout << x;\n  return 0;\n}\n')
      const call = find(tree, (n) => n.componentId === 'cpp:func_call')!
      const { s, out } = open(p, tree)
      s.setBreakpoints([call.id])
      expect(await s.launch(tree, { stopOnEntry: false })).toMatchObject({ kind: 'stopped', stop: { reason: 'breakpoint', nodeId: call.id } })
      expect(out(), '停在呼叫之前，f 還沒印').toBe('')
      expect(await s.continue()).toEqual({ kind: 'ended' })
      expect(out()).toBe('12')
    })

    it('🔴 中斷點設在迴圈裡的指定敘述上：停在第一次、變數在（不能停在拿不到呼叫框的運算式上）', async () => {
      const tree = lift(LOOP)
      const assign = find(tree, (n) => n.componentId === 'cpp:var_assign')!
      const { s } = open(p, tree)
      s.setBreakpoints([assign.id])
      expect(await s.launch(tree, { stopOnEntry: false })).toMatchObject({ kind: 'stopped', stop: { reason: 'breakpoint', nodeId: assign.id } })
      expect(Object.fromEntries(s.variables().map((v) => [v.name, v.value]))).toMatchObject({ s: '0', i: '0' })
    })

    it('🔴 覆蓋（spec 194）：一次跑完，迴圈身體的指定敘述進入 4 次、印出那一句 1 次；鍵是語義樹的 id', async () => {
      const tree = lift(LOOP)
      const assign = find(tree, (n) => n.componentId === 'cpp:var_assign')!
      const print = find(tree, (n) => n.componentId === 'cpp:print')!
      const { s } = open(p, tree)
      expect(await s.launch(tree, { stopOnEntry: false })).toEqual({ kind: 'ended' })
      const cov = s.coverage()
      expect(cov, '🔴 給不出覆蓋（Cella 的除錯模組沒有匯出 stopVisits？）').not.toBeNull()
      expect(cov!.get(assign.id), '迴圈跑 4 圈').toBe(4)
      expect(cov!.get(print.id)).toBe(1)
      expect([...cov!.keys()].every((k) => !k.includes('/')), '鍵是語義樹的 id，不是 Cella 的標籤').toBe(true)
    })

    it('★ 單步：stopOnEntry 停在第一步，每次 stepIn 往前一顆，最後跑完', async () => {
      const tree = lift(LOOP)
      const { s, out } = open(p, tree)
      let o = await s.launch(tree, { stopOnEntry: true })
      // 第一個停點叫 entry（DAP）或 step 都可以——控制器兩者一視同仁
      expect(o.kind === 'stopped' && ['entry', 'step'].includes(o.stop.reason), JSON.stringify(o)).toBe(true)
      const seen: string[] = []
      let guard = 0
      while (o.kind === 'stopped' && guard++ < 500) { seen.push(o.stop.nodeId ?? ''); o = await s.stepIn() }
      expect(seen.filter((id) => /[/#]/.test(id)), '🔴 停點回報的要是語義樹的 id，不是提供者自己的標籤').toEqual([])
      expect(o).toEqual({ kind: 'ended' })
      expect(new Set(seen).size, '單步應該經過好幾顆不同的節點').toBeGreaterThan(3)
      expect(out()).toBe('6\n')
    })

    it('★ 讀輸入：停在 awaiting-input，給了一行之後繼續', async () => {
      const tree = lift(READ)
      const { s, out } = open(p, tree)
      const o = await s.launch(tree, { stopOnEntry: false })
      expect(o).toMatchObject({ kind: 'stopped', stop: { reason: 'awaiting-input' } })
      expect(await s.supplyInput('21')).toEqual({ kind: 'ended' })
      expect(out()).toBe('42\n')
      expect(s.recordedInputs()).toContainEqual({ kind: 'stdin', value: '21' })
    })

    it('★ 改變數：停著改值，繼續之後的輸出反映它，而且留下紀錄', async () => {
      const tree = lift(LOOP)
      const target = find(tree, (n) => n.componentId === 'cpp:print')!
      const { s, out } = open(p, tree)
      s.setBreakpoints([target.id])
      await s.launch(tree, { stopOnEntry: false })
      expect(await s.setVariable('s', '100')).toBe(true)
      await s.continue()
      expect(out()).toBe('100\n')
      expect(s.recordedInputs().some((i) => i.kind === 'set-variable')).toBe(true)
    })

    it('★ 執行期錯誤：failed，帶 SessionStop（控制器只認這一種）', async () => {
      const tree = lift(DIV0)
      const { s } = open(p, tree)
      const o = await s.launch(tree, { stopOnEntry: false })
      expect(o.kind).toBe('failed')
      if (o.kind === 'failed') {
        expect(o.error).toBeInstanceOf(SessionStop)
        expect(o.error.kind).toBe('runtime')
      }
    })

    it('🔴 停著時 terminate：下一個指令不會卡住，回 aborted', async () => {
      const tree = lift(LOOP)
      const { s } = open(p, tree)
      await s.launch(tree, { stopOnEntry: true })
      s.terminate()
      const o = await s.continue()
      expect(o.kind === 'ended' || (o.kind === 'failed' && o.error.kind === 'aborted'), JSON.stringify(o)).toBe(true)
    })
  })
}

// ─── Python（spec 195b）：同一份契約，Python 的程式 ───────────────────────────
const PY_LOOP = 's = 0\nfor i in range(4):\n    s = s + i\nprint(s)\n'
const PY_READ = 'n = int(input())\nprint(n * 2)\n'
const PY_ERR = 'a = 1\nb = 0\nprint(a // b)\n'
const pyFormal = (tree: SemanticNode) => ({ tree, targetId: 'python', styleId: 'python', skeletonId: 'none' })
async function liftPy(code: string): Promise<SemanticNode> { return (await liftPython(code))! }

for (const entry of PROVIDERS) {
  describe(`執行工作階段的契約（Python）：${entry.id}`, () => {
    let p: Provider
    const openPy = (tree: SemanticNode): { s: ExecutionSession; out: () => string } => {
      const s = p.createSession!({ maxSteps: 1_000_000, formal: pyFormal(tree) as never }, tree)
      if ('declined' in s) throw new Error(`${p.id} 不接：${s.declined}`)
      let text = ''
      s.onOutput((t) => { text += t })
      return { s, out: () => text }
    }
    beforeAll(async () => {
      p = await entry.make()
      // Cella：第一次 createSession 會開始編 Python 的除錯模組，編好之前它不接
      const tree = await liftPy(PY_LOOP)
      await until(() => !('declined' in p.createSession!({ maxSteps: 1, formal: pyFormal(tree) as never }, tree)), 300_000)
    }, 600_000)

    it('★ 沒有中斷點：一路跑完，輸出正確', async () => {
      const tree = await liftPy(PY_LOOP)
      const { s, out } = openPy(tree)
      expect(await s.launch(tree, { stopOnEntry: false })).toEqual({ kind: 'ended' })
      expect(out()).toBe('6\n')
    })

    it('★ 中斷點：停在 print、看得到 s；繼續跑完', async () => {
      const tree = await liftPy(PY_LOOP)
      const target = find(tree, (n) => n.componentId === 'python:print')!
      const { s, out } = openPy(tree)
      s.setBreakpoints([target.id])
      expect(await s.launch(tree, { stopOnEntry: false })).toMatchObject({ kind: 'stopped', stop: { reason: 'breakpoint', nodeId: target.id } })
      expect(s.variables().find((v) => v.name === 's')?.value).toBe('6')
      expect(await s.continue()).toEqual({ kind: 'ended' })
      expect(out()).toBe('6\n')
    })

    it('★ 讀輸入：停在 awaiting-input，給了一行之後繼續', async () => {
      const tree = await liftPy(PY_READ)
      const { s, out } = openPy(tree)
      expect(await s.launch(tree, { stopOnEntry: false })).toMatchObject({ kind: 'stopped', stop: { reason: 'awaiting-input' } })
      expect(await s.supplyInput('21')).toEqual({ kind: 'ended' })
      expect(out()).toBe('42\n')
    })

    it('★ 執行期錯誤（ZeroDivisionError）：failed，帶 SessionStop', async () => {
      const tree = await liftPy(PY_ERR)
      const { s } = openPy(tree)
      const o = await s.launch(tree, { stopOnEntry: false })
      expect(o.kind, JSON.stringify(o)).toBe('failed')
      if (o.kind === 'failed') expect(o.error).toBeInstanceOf(SessionStop)
    })

    it('🔴 覆蓋：迴圈身體的指定敘述進入 4 次；鍵是語義樹的 id', async () => {
      const tree = await liftPy(PY_LOOP)
      const assign = find(tree, (n) => n.componentId === 'python:var_assign' && JSON.stringify(n).includes('"i"'))!
      const { s } = openPy(tree)
      expect(await s.launch(tree, { stopOnEntry: false })).toEqual({ kind: 'ended' })
      const cov = s.coverage()
      expect(cov, '給不出覆蓋').not.toBeNull()
      expect(cov!.get(assign.id)).toBe(4)
    })
  })
}
