/** `cpp:arduino_string_as_int` 的自證測（435）。 */
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

describe('cpp:arduino_string_as_int', () => {
  it('lift —— String 上的 toInt()', () => {
    const ids = collect(lift(sketch('  String s = "42";\n  int v = s.toInt();')))
    expect(ids).toContain('cpp:arduino_string_as_int')
    expect(ids).not.toContain('cpp:method_call')
  })
  it('lift —— 帶引數就不是它', () => {
    const ids = collect(lift(sketch('  String s = "42";\n  int v = s.toInt(3);')))
    expect(ids).toContain('cpp:method_call')
    expect(ids).not.toContain('cpp:arduino_string_as_int')
  })
  it('generate ＋ round-trip', () => {
    const src = sketch('  String s = "42";\n  int v = s.toInt();\n  Serial.println(v + 1);')
    const once = generateCode(lift(src), 'cpp', S)
    expect(once).toContain('int v = s.toInt();')
    expect(generateCode(lift(once), 'cpp', S)).toBe(once)
  })
  for (const board of ['uno', 'esp32']) {
    it(`執行（${board}）—— 開頭不是數字回 0`, async () => {
      await expectCellaOut(sketch('  String s = "42";\n  String t = "ab";\n  Serial.println(s.toInt() + 1);\n  Serial.println(t.toInt());'), '43\r\n0\r\n', { board })
    })
  }
})
