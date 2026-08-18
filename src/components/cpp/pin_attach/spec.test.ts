/**
 * `cpp:pin_attach` 的自證測。
 *
 * ## 🔴 這顆的重點全在 lift，而它有三個必須分得開的情形
 *
 * ```
 * ① const int ledPin = 13;  ＋ pinMode(ledPin, OUTPUT)  → 是這顆，device=led
 * ② const int MAX = 100;    （沒被當腳位用）             → 【不是】這顆，不准搶
 * ③ const int ENA = 5;      ＋ analogWrite(ENA, 200)     → 是這顆，device=unknown
 * ```
 *
 * ③ 是這顆設計的核心：**結構認得出來、標籤認不出來**。
 * `ENA` 是 L298N 馬達驅動的慣例腳位名，名字裡沒有零件資訊
 * ——而那不是缺陷，是「名字裡真的沒有」。
 *
 * ⚠️ ② 是**不搶**的證明。同資料夾層級的腳位常數那顆付過這筆學費
 * （靠名字認人，把使用者宣告的 `enum Level { LOW = -1 }` 搶走）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { SemanticInterpreter } from '../../../interpreter/interpreter'
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
const collect = (n: SemanticNode, out: SemanticNode[] = []): SemanticNode[] => {
  out.push(n)
  for (const ks of Object.values(n.children ?? {})) for (const k of ks) collect(k, out)
  return out
}
const ids = (n: SemanticNode): string[] => collect(n).map((x) => x.conceptId)
const attachIn = (n: SemanticNode): SemanticNode[] =>
  collect(n).filter((x) => x.conceptId === 'cpp:pin_attach')

describe('cpp:pin_attach', () => {
  it('① lift —— 被當腳位用的常數變成接線，而零件從名字讀', () => {
    const tree = lift(
      'const int ledPin = 13;\nvoid setup() { pinMode(ledPin, OUTPUT); }\nvoid loop() {}\n',
    )
    expect(ids(tree)).toContain('cpp:pin_attach')          // ← 正向錨點
    const [a] = attachIn(tree)
    expect(a.properties.name).toBe('ledPin')
    expect(a.properties.pin).toBe('13')
    expect(a.properties.device).toBe('led')
    expect(ids(tree)).not.toContain('cpp:raw_code')
  })

  it('🔴 ② 沒被當腳位用的常數【不准】被搶走', () => {
    const tree = lift('const int MAX = 100;\nvoid setup() {}\nvoid loop() {}\n')
    // ← 正向錨點：先證明它真的被辨識成了「某顆常數宣告」，
    //   否則下面的負向斷言在 lift 失敗時也會通過
    expect(ids(tree)).toContain('cpp:var_declare_const')
    expect(ids(tree)).not.toContain('cpp:pin_attach')
  })

  it('🔴 ③ 結構認得出來但名字認不出來 → device 是 unknown，而結構成立', () => {
    const tree = lift(
      'const int ENA = 5;\nvoid setup() { pinMode(ENA, OUTPUT); }\nvoid loop() { analogWrite(ENA, 200); }\n',
    )
    expect(ids(tree)).toContain('cpp:pin_attach')          // ← 結構
    expect(attachIn(tree)[0].properties.device).toBe('unknown')   // ← 標籤退了
  })

  it('⚠️ 非整數字面量不認 —— 認了會在 round-trip 弄丟那個算式', () => {
    const tree = lift(
      'const int base = 2;\nconst int ledPin = base + 1;\nvoid setup() { pinMode(ledPin, OUTPUT); }\nvoid loop() {}\n',
    )
    expect(ids(tree)).toContain('cpp:var_declare_const')   // ← 正向錨點
    expect(attachIn(tree).map((a) => a.properties.name)).not.toContain('ledPin')
  })

  it('generate —— 產回一行常數宣告，而 device 不影響輸出', () => {
    const src = 'const int buzzerPin = 8;\nvoid setup() { pinMode(buzzerPin, OUTPUT); }\nvoid loop() {}\n'
    const tree = lift(src)
    expect(attachIn(tree)[0].properties.device).toBe('buzzer')   // ← 正向錨點
    const out = generateCode(tree, 'cpp', apcs as StylePreset)
    expect(out).toContain('const int buzzerPin = 8;')
    // 🔴 零件種類在程式碼裡沒有對應——它不得洩漏出去
    expect(out).not.toContain('buzzer"')
    expect(out).not.toContain('device')
  })

  it('round-trip —— 兩趟身分與屬性都不漂移', () => {
    const src = 'const int trigPin = 9;\nvoid setup() { pinMode(trigPin, OUTPUT); }\nvoid loop() {}\n'
    const one = lift(src)
    const gen1 = generateCode(one, 'cpp', apcs as StylePreset)
    const two = lift(gen1)
    const gen2 = generateCode(two, 'cpp', apcs as StylePreset)
    expect(attachIn(two).length).toBe(1)                   // ← 正向錨點
    expect(attachIn(two)[0].properties).toEqual(attachIn(one)[0].properties)
    expect(gen2).toBe(gen1)
  })

  it('🔴 execute —— 變數的值是【腳位號】，不是型別預設值', async () => {
    const i = new SemanticInterpreter({ maxSteps: 100_000 })
    await i.execute(
      lift(
        'const int ledPin = 13;\n' +
          'void setup() { pinMode(ledPin, OUTPUT); Serial.println(ledPin); }\n' +
          'void loop() {}\n',
      ),
    )
    // ⚠️ 這一條就是那個 bug 本身：沿用常數宣告的執行器會印出 0
    expect(i.getOutput().join('')).toContain('13')
  })

  it('🔴 ⑥ 三種宣告形式都認得，而 round-trip 回得去【原樣】', () => {
    // 盲測（20 段隔離語料）量到的分佈：const int 19 · #define 10 · int 3
    // ——只認 const 的話，41% 的腳位宣告轉不成接線積木。
    const cases: [string, string, string][] = [
      ['const', 'const int ledPin = 13;\n', 'const int ledPin = 13;'],
      ['define', '#define ledPin 13\n', '#define ledPin 13'],
      ['plain', 'int ledPin = 13;\n', 'int ledPin = 13;'],
    ]
    for (const [style, decl, expected] of cases) {
      const src = `${decl}void setup() { pinMode(ledPin, OUTPUT); }\nvoid loop() {}\n`
      const tree = lift(src)
      const [a] = attachIn(tree)
      expect(a, `${style}：沒有認出接線`).toBeDefined()          // ← 正向錨點
      expect(a.properties.style).toBe(style)
      expect(a.properties.pin).toBe('13')
      expect(a.properties.device).toBe('led')
      // 🔴 產回原樣——不記形式的話，學生的 #define 會被靜默改寫成 const int
      const out = generateCode(tree, 'cpp', apcs as StylePreset)
      expect(out, `${style}：形式沒有回得去`).toContain(expected)
    }
  })

  it('⚠️ 裸 int 放寬之後，一般變數仍然不准被搶', () => {
    // 擋住誤認的從來不是 `const`，是「它有沒有被當腳位用」——這一條證明它還在守
    const tree = lift('int counter = 0;\nint total = 100;\nvoid setup() {}\nvoid loop() { counter = counter + 1; }\n')
    expect(ids(tree)).toContain('cpp:var_declare')             // ← 正向錨點
    expect(ids(tree)).not.toContain('cpp:pin_attach')
  })
})
