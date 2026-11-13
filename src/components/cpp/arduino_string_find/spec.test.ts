/** `cpp:arduino_string_find` 的自證測（435）。 */
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

describe('cpp:arduino_string_find', () => {
  it('lift —— String 上的 indexOf，一個與兩個引數', () => {
    const ids = collect(lift(sketch('  String s = "a,b,c";\n  int i = s.indexOf(\',\');\n  int j = s.indexOf(\',\', i + 1);')))
    expect(ids.filter((x) => x === 'cpp:arduino_string_find')).toHaveLength(2)
    expect(ids).not.toContain('cpp:method_call')
  })
  it('lift —— 自己的類別上的 indexOf 不認', () => {
    const ids = collect(lift('struct Box { int indexOf(int x) { return x; } };\nvoid setup() {\n  Box b;\n  int i = b.indexOf(3);\n}\nvoid loop() {\n}\n'))
    expect(ids).toContain('cpp:method_call')
    expect(ids).not.toContain('cpp:arduino_string_find')
  })
  it('generate ＋ round-trip —— 第二個引數留空時不寫', () => {
    const src = sketch('  String s = "a,b,c";\n  int i = s.indexOf(\',\');\n  int j = s.indexOf(\',\', i + 1);\n  Serial.println(j);')
    const once = generateCode(lift(src), 'cpp', S)
    expect(once).toContain("s.indexOf(',');")
    expect(once).toContain("s.indexOf(',', i + 1);")
    expect(generateCode(lift(once), 'cpp', S)).toBe(once)
  })
  for (const board of ['uno', 'esp32']) {
    it(`執行（${board}）—— 找得到與找不到（-1）`, async () => {
      await expectCellaOut(sketch('  String s = "a,b,c";\n  int i = s.indexOf(\',\');\n  Serial.println(i);\n  Serial.println(s.indexOf(\',\', i + 1));\n  Serial.println(s.indexOf(\'x\'));'), '1\r\n3\r\n-1\r\n', { board })
    })
  }
})
