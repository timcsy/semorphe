/** `cpp:math_constrain` 的自證測。 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { expectCellaOut, runCella, describeCellaResult } from '../../../../tests/helpers/cella-run'
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
const lift = (c: string): SemanticNode =>
  createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode
const collect = (n: SemanticNode, out: string[] = []): string[] => {
  out.push(n.componentId)
  for (const ks of Object.values(n.slots ?? {})) for (const k of ks) collect(k, out)
  return out
}
// spec 198（重構 6c-1）：執行的判準從 JS 直譯器換成 Cella（`tests/helpers/cella-run.ts`）

describe('cpp:math_constrain', () => {
  it('lift —— 認得出身分', () => {
    const ids = collect(lift('void setup() { int v = constrain(5, 0, 10); }\nvoid loop() {}\n'))
    expect(ids).toContain('cpp:math_constrain')   // ← 正向錨點
    expect(ids).not.toContain('cpp:raw_code')
  })

  it('generate —— 產回原本的呼叫', () => {
    const code = generateCode(lift('void setup() { int v = constrain(5, 0, 10); }\nvoid loop() {}\n'), 'cpp', apcs as StylePreset)
    expect(code).toContain('constrain(5, 0, 10)')
  })

  it('round-trip —— 不漂移', () => {
    const src = 'void setup() {\n  int v = constrain(20, 0, 10);\n}\nvoid loop() {\n}\n'
    const once = generateCode(lift(src), 'cpp', apcs as StylePreset)
    expect(generateCode(lift(once), 'cpp', apcs as StylePreset)).toBe(once)
  })

  // 433：Cella 的 Arduino 核心有 constrain（`@cella-lang/arduino` README 的 core）——在板子上接上；標準 C++ 沒有它，照實翻不出
  const sketch = (body: string) => `void setup() {\n  Serial.begin(9600);\n${body}\n}\nvoid loop() {}\n`
  it('執行（Uno）—— 三種情形（低於、範圍內、高於）', async () => {
    await expectCellaOut(sketch(`  Serial.println(constrain(-5, 0, 10));\n  Serial.println(constrain(5, 0, 10));\n  Serial.println(constrain(50, 0, 10));`),
      '0\r\n5\r\n10\r\n', { board: 'uno' })
  })

  it('執行（Uno）—— ⚠️ 型別跟著走：小數不得被夾成整數', async () => {
    // 🔴 回傳的是【原本那個值】，不是重新包一個 int
    await expectCellaOut(sketch(`  double d = constrain(2.5, 0.0, 10.0);\n  Serial.println(d);`), '2.50\r\n', { board: 'uno' })
  })

  it('不在板子上：照實翻不出，不送一個會被判「呼叫未宣告的函式」的呼叫', async () => {
    const r = await runCella('#include <iostream>\nusing namespace std;\nint main() { cout << constrain(5, 0, 10); }\n')
    const text = describeCellaResult(r)
    expect(text).toContain('翻不出')
    expect(text).toContain('constrain 是 Arduino 的巨集')
  })
})
