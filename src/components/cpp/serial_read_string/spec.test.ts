/** `cpp:serial_read_string` 的自證測（435）。 */
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

describe('cpp:serial_read_string', () => {
  it('lift —— Serial.readStringUntil', () => {
    const ids = collect(lift(sketch("  String line = Serial.readStringUntil('\\n');")))
    expect(ids).toContain('cpp:serial_read_string')
    expect(ids).not.toContain('cpp:method_call')
  })
  it('lift —— 別的物件上的同名方法不認', () => {
    const ids = collect(lift('struct Port { int readStringUntil(char c) { return c; } };\nvoid setup() {\n  Port p;\n  int x = p.readStringUntil(10);\n}\nvoid loop() {\n}\n'))
    expect(ids).toContain('cpp:method_call')
    expect(ids).not.toContain('cpp:serial_read_string')
  })
  it('generate ＋ round-trip —— 接著呼叫 String 的方法', () => {
    const src = sketch("  String line = Serial.readStringUntil('\\n');\n  line.trim();\n  int n = Serial.readStringUntil(',').toInt();\n  Serial.println(n);")
    const tree = lift(src)
    expect(collect(tree)).toContain('cpp:arduino_string_as_int')
    const once = generateCode(tree, 'cpp', S)
    expect(once).toContain("String line = Serial.readStringUntil('\\n');")
    expect(once).toContain("Serial.readStringUntil(',').toInt()")
    expect(generateCode(lift(once), 'cpp', S)).toBe(once)
  })
  for (const board of ['uno', 'esp32']) {
    it(`執行（${board}）—— 讀到換行為止，不含換行`, async () => {
      await expectCellaOut(sketch("  String line = Serial.readStringUntil('\\n');\n  Serial.print(\"[\");\n  Serial.print(line);\n  Serial.println(\"]\");"), '[ab]\r\n', { board, stdin: 'ab\ncd\n' })
    })
  }
})
