/** `cpp:arduino_string_substr` 的自證測（435）。 */
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

describe('cpp:arduino_string_substr', () => {
  it('lift —— substring 一個與兩個引數', () => {
    const ids = collect(lift(sketch('  String s = "hello";\n  String a = s.substring(1, 3);\n  String b = s.substring(2);')))
    expect(ids.filter((x) => x === 'cpp:arduino_string_substr')).toHaveLength(2)
    expect(ids).not.toContain('cpp:method_call')
  })
  it('lift —— 接著呼叫：s.substring(2).toInt()', () => {
    const ids = collect(lift(sketch('  String s = "x=42";\n  int v = s.substring(2).toInt();')))
    expect(ids).toContain('cpp:arduino_string_substr')
    expect(ids).toContain('cpp:arduino_string_as_int')
  })
  it('generate ＋ round-trip', () => {
    const src = sketch('  String s = "hello";\n  Serial.println(s.substring(1, 3));\n  Serial.println(s.substring(2));')
    const once = generateCode(lift(src), 'cpp', S)
    expect(once).toContain('s.substring(1, 3)')
    expect(once).toContain('s.substring(2)')
    expect(generateCode(lift(once), 'cpp', S)).toBe(once)
  })
  for (const board of ['uno', 'esp32']) {
    it(`執行（${board}）—— 第二個數字是終點不是長度`, async () => {
      await expectCellaOut(sketch('  String s = "hello";\n  Serial.println(s.substring(1, 3));\n  Serial.println(s.substring(2));'), 'el\r\nllo\r\n', { board })
    })
  }
})
