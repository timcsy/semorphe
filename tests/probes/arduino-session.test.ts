/**
 * **探針：板子程式的除錯工作階段**（spec 185）——暫停時的 `readEnv`、改感測器輸入 `setInput`、`clockMs`。
 * 只在 `ARDUINO_SESSION_PROBE=1` 時跑（要編 arduino 的除錯模組，幾十秒）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Parser, Language } from 'web-tree-sitter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { createTestLifter } from '../helpers/setup-lifter'
import { formalize, cellaBoardOf } from '../../src/providers/cella/formalize'
import { compileCellaDebugger } from '../../src/providers/cella/debugger'
import type { SemanticNode } from '../../src/core/types'

const RUN = process.env.ARDUINO_SESSION_PROBE === '1'
let bytes: Uint8Array
let lift: (c: string) => SemanticNode
beforeAll(async () => {
  if (!RUN) return
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  const parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
  lift = (c) => createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode
  const t = Date.now()
  bytes = await compileCellaDebugger((pkg, file) => fs.readFileSync(path.join('node_modules', pkg === null ? 'cella-lang' : `@cella-lang/${pkg}`, file)), 'arduino')
  console.log(`arduino 除錯模組 ${Date.now() - t} ms、${bytes.length} bytes`)
}, 400_000)

describe.skipIf(!RUN)('板子程式的除錯工作階段', () => {
  it('★ 量：暫停時的 env、改 A0 之後的行為、clockMs', async () => {
    const { createSession } = await import('cella-lang/dap' as string)
    const tree = lift('void setup() {\n  pinMode(13, OUTPUT);\n}\nvoid loop() {\n  int v = analogRead(A0);\n  if (v > 500) {\n    digitalWrite(13, HIGH);\n  } else {\n    digitalWrite(13, LOW);\n  }\n  delay(100);\n}\n')
    const f = formalize(tree, { board: cellaBoardOf('arduino-uno') })
    expect(f.program, JSON.stringify(f.unknown)).toBeTruthy()
    const s = await createSession(bytes, { program: JSON.stringify(f.program) })
    const find = (n: SemanticNode, id: string): SemanticNode | undefined => n.componentId === id ? n : Object.values(n.slots ?? {}).flat().map((c) => find(c, id)).find(Boolean)
    const dw = find(tree, 'cpp:delay')!
    const labels: string[] = []
    JSON.stringify(f.program, (k, v) => { if (k === 'n' && typeof v === 'string' && v.split(/[/#]/)[0] === dw.id) labels.push(v); return v })
    console.log('delay 的標籤', JSON.stringify(labels))
    s.setBreakpoints(labels)
    await s.launch({ stopOnEntry: false })
    console.log('第一次停：', s.node, 'env', JSON.stringify(s.readEnv()).slice(0, 300))
    console.log('setInput', JSON.stringify(s.setInput('analog:A0', '900')))
    await s.continue()
    console.log('改 A0=900 之後再停：env', JSON.stringify(s.readEnv()).slice(0, 300))
    console.log('inputScript', JSON.stringify(s.inputScript()))
  }, 300_000)
})
