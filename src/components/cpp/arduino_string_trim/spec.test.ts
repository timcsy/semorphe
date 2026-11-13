/** `cpp:arduino_string_trim` 的自證測（435）。 */
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

describe('cpp:arduino_string_trim', () => {
  it('lift —— 宣告成 String 的變數上的 trim()', () => {
    const ids = collect(lift(sketch('  String s = "  hi ";\n  s.trim();')))
    expect(ids).toContain('cpp:arduino_string_trim')   // 正向錨點
    expect(ids).not.toContain('cpp:method_call')
  })

  it('lift —— 接在讀一行後面：Serial.readStringUntil(...).trim()', () => {
    const ids = collect(lift(sketch("  Serial.readStringUntil('\\n').trim();")))
    expect(ids).toContain('cpp:arduino_string_trim')
  })

  it('lift —— 型別查不到（自己的類別）就不認，留在通用的方法呼叫', () => {
    const ids = collect(lift('struct Box { void trim() {} };\nvoid setup() {\n  Box b;\n  b.trim();\n}\nvoid loop() {\n}\n'))
    expect(ids).toContain('cpp:method_call')            // 正向錨點：還是認得出是方法呼叫
    expect(ids).not.toContain('cpp:arduino_string_trim')
  })

  it('generate ＋ round-trip —— 一字不差', () => {
    const src = sketch('  String s = "  hi ";\n  s.trim();\n  Serial.println(s);')
    const once = generateCode(lift(src), 'cpp', S)
    expect(once).toContain('  s.trim();\n')
    expect(generateCode(lift(once), 'cpp', S)).toBe(once)
  })

  for (const board of ['uno', 'esp32']) {
    it(`執行（${board}）—— 就地去掉頭尾空白`, async () => {
      await expectCellaOut(sketch('  String s = "ab  ";\n  s.trim();\n  Serial.print("[");\n  Serial.print(s);\n  Serial.println("]");'), '[ab]\r\n', { board })
    })
  }
})
