/**
 * 434：Arduino 語料（探針 arduino-realistic／wide）裡兩類【翻不出】與一類【安靜地改掉程式】。
 *
 * ① `byte`／`boolean`（Arduino.h 的 typedef）：Cella 的模型還不認得這兩個名字 → 前端照 typedef 送 tUChar／tBool（Cella 補了名字再改回）
 * ② `volatile bool f`：原本 `volatile` 被丟掉，產回去 `bool f`——另一支程式。在宣告裝得下它之前整句誠實降級
 * ③ `void IRAM_ATTR onPress()`：解析器補了不存在的 `::`，被當成類別外的方法定義，產回去 `void IRAM_ATTR::onPress()`——編不過。整段誠實降級
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'
import { expectCellaOut, runCella } from '../helpers/cella-run'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
}, 30000)

const lift = (code: string) => createTestLifter().lift(parser.parse(code)!.rootNode as never) as SemanticNode
const ids = (n: SemanticNode): string[] => [n.componentId, ...Object.values(n.slots ?? {}).flat().flatMap(ids)]
const sketch = (top: string, body: string) => `${top}\nvoid setup() {\n  Serial.begin(9600);\n${body}\n}\nvoid loop() {}\n`

describe('Arduino.h 的 byte／boolean', () => {
  for (const board of ['uno', 'esp32']) {
    it(`${board}：byte 255 + 1 繞回 0；boolean 照 bool`, async () => {
      await expectCellaOut(sketch('byte g = 200;', '  byte x = 255;\n  x = x + 1;\n  boolean b = 5;\n  Serial.println(x);\n  Serial.println(g);\n  Serial.println(b);'),
        '0\r\n200\r\n1\r\n', { board })
    })
  }
  it('不在板子上：byte 不是標準 C++ 的型別，照實翻不出', async () => {
    const r = await runCella('int main() { byte x = 1; }\n')
    expect(r.verdict).toBe('untranslated')
  })
})

describe('不認得的修飾字與屬性巨集：誠實降級，不改掉程式', () => {
  const ISR = 'volatile bool pressed = false;\nvoid IRAM_ATTR onPress() {\n  pressed = true;\n}\nvoid setup() {\n  attachInterrupt(digitalPinToInterrupt(0), onPress, FALLING);\n}\nvoid loop() {\n  if (pressed) {\n    pressed = false;\n  }\n}\n'

  it('volatile：整句降級，產回去一字不差', () => {
    const t = lift('volatile bool pressed = false;\n')
    expect(ids(t)).toContain('cpp:raw_code')            // 正向錨點：降級了
    expect(ids(t)).not.toContain('cpp:var_declare')     // 不是丟掉 volatile 的一般宣告
    expect(generateCode(t, 'cpp', apcs as StylePreset)).toContain('volatile bool pressed = false;')
  })

  it('IRAM_ATTR：整段降級，不被當成類別外的方法定義', () => {
    const t = lift(ISR)
    expect(ids(t)).toContain('cpp:raw_code')
    expect(ids(t)).not.toContain('cpp:method_def_outside')
    const out = generateCode(t, 'cpp', apcs as StylePreset)
    expect(out).toContain('void IRAM_ATTR onPress() {')
    expect(out).not.toContain('IRAM_ATTR::')
    expect(generateCode(lift(out), 'cpp', apcs as StylePreset)).toBe(out)
  })

  it('翻給 Cella：照實翻不出（不送一個被改掉的程式）', async () => {
    const r = await runCella(ISR, { board: 'esp32' })
    expect(r.verdict).toBe('untranslated')
  })
})

describe('437：中斷函式在 Cella 有模型之前照實翻不出，不被判「未宣告」', () => {
  // 🔴 一支合法的中斷 sketch，原本被 Cella 說「use of undeclared identifier 'attachInterrupt'」（P6：說合法的程式有錯）
  const INT = '#include <Arduino.h>\nint n = 0;\nvoid onPress() {\n  n++;\n}\nvoid setup() {\n  Serial.begin(9600);\n  attachInterrupt(digitalPinToInterrupt(2), onPress, FALLING);\n}\nvoid loop() {\n  noInterrupts();\n  int c = n;\n  interrupts();\n  Serial.println(c);\n  delay(1000);\n}\n'
  for (const board of ['uno', 'esp32']) {
    it(`${board}：翻不出，原因指名中斷`, async () => {
      // 正向錨點：同一支去掉中斷呼叫就判得出
      const plain = await runCella(INT.replace('  attachInterrupt(digitalPinToInterrupt(2), onPress, FALLING);\n', '').replace('  noInterrupts();\n', '').replace('  interrupts();\n', ''), { board })
      expect(plain.verdict).not.toBe('untranslated')
      const r = await runCella(INT, { board })
      expect(r.verdict).toBe('untranslated')
      expect(r.untranslated.map((u) => u.reason).join('\n')).toMatch(/中斷/)
      expect(r.problems.some((p) => p.kind === 'undeclared')).toBe(false)
    }, 120_000)
  }
})
