/** `cpp:serial_read_number` 的自證測（435）。 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { expectCellaOut } from '../../../../tests/helpers/cella-run'
import { generateCode } from '../../../core/projection/code-generator'
import apcs from '../../../languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../../core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})
const lift = (c: string): SemanticNode => createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode
const collect = (n: SemanticNode, out: string[] = []): string[] => {
  out.push(n.componentId)
  for (const ks of Object.values(n.slots ?? {})) for (const k of ks) collect(k, out)
  return out
}
const S = apcs as StylePreset
const sketch = (body: string) => `void setup() {\n  Serial.begin(9600);\n${body}\n}\nvoid loop() {\n}\n`

describe('cpp:serial_read_number', () => {
  it('lift —— Serial.parseInt()', () => {
    const ids = collect(lift(sketch('  int n = Serial.parseInt();')))
    expect(ids).toContain('cpp:serial_read_number')
    expect(ids).not.toContain('cpp:method_call')
  })
  it('generate ＋ round-trip', () => {
    const src = sketch('  int n = Serial.parseInt();\n  Serial.println(n * 2);')
    const once = generateCode(lift(src), 'cpp', S)
    expect(once).toContain('int n = Serial.parseInt();')
    expect(generateCode(lift(once), 'cpp', S)).toBe(once)
  })
  for (const board of ['uno', 'esp32']) {
    it(`執行（${board}）—— 跳過前面的非數字`, async () => {
      await expectCellaOut(sketch('  int n = Serial.parseInt();\n  Serial.println(n * 2);'), '42\r\n', { board, stdin: 'x 21\n' })
    })
  }
})
