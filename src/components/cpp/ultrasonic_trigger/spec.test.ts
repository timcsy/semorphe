/**
 * `cpp:ultrasonic_trigger` 的自證測。
 *
 * ## 🔴 這顆的風險與別顆不同：它的辨識跑在【每一個大括號】上
 *
 * 所以測試除了「認得出來」，還必須釘住「**不該認的時候不認**」——
 * 而後者才是這顆的主要風險：一個過寬的序列比對會把別人的程式碼摺掉。
 *
 * ```
 * ① 標準觸發序列                → 摺成一顆
 * ② 中間插了一句                → 不摺（那不是一次觸發）
 * ③ 微秒數不是 2／10            → 不摺（那是學生自己改的，不准動他的）
 * ④ 三次 digitalWrite 不同腳    → 不摺（兩件事湊巧排在一起）
 * ⑤ 語料實況：觸發之後接 pulseIn ＋ 換算 → 觸發摺、換算【不摺】
 * ```
 *
 * ⑤ 是這顆設計的核心：摺什麼是**數出來的**（觸發 14/14、換算緊鄰 9/14）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { generateCode } from '../../../core/projection/code-generator'
import { SemanticInterpreter } from '../../../interpreter/interpreter'
import { pinsOf } from '../../../languages/cpp/core/runtime/arduino-pins'
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
const ids = (n: SemanticNode, out: string[] = []): string[] => {
  out.push(n.conceptId)
  for (const ks of Object.values(n.children ?? {})) for (const k of ks) ids(k, out)
  return out
}
const count = (n: SemanticNode, id: string): number => ids(n).filter((x) => x === id).length

const TRIG = (pin: string, us1 = '2', us2 = '10'): string =>
  `  digitalWrite(${pin}, LOW);\n  delayMicroseconds(${us1});\n` +
  `  digitalWrite(${pin}, HIGH);\n  delayMicroseconds(${us2});\n  digitalWrite(${pin}, LOW);\n`
const sketch = (body: string): string =>
  `const int trigPin = 9;\nconst int echoPin = 10;\nvoid setup() { pinMode(trigPin, OUTPUT); }\nvoid loop() {\n${body}}\n`

describe('cpp:ultrasonic_trigger', () => {
  it('① 標準觸發序列摺成一顆，而那五句不再各自出現', () => {
    const tree = lift(sketch(TRIG('trigPin')))
    expect(count(tree, 'cpp:ultrasonic_trigger')).toBe(1)      // ← 正向錨點
    expect(count(tree, 'cpp:digital_write')).toBe(0)
    expect(count(tree, 'cpp:delay_microseconds')).toBe(0)
  })

  it('🔴 ② 中間插了一句 → 不摺（那不是一次觸發）', () => {
    const body =
      `  digitalWrite(trigPin, LOW);\n  delayMicroseconds(2);\n  Serial.println("x");\n` +
      `  digitalWrite(trigPin, HIGH);\n  delayMicroseconds(10);\n  digitalWrite(trigPin, LOW);\n`
    const tree = lift(sketch(body))
    expect(count(tree, 'cpp:digital_write')).toBe(3)           // ← 正向錨點：五句都還在
    expect(count(tree, 'cpp:ultrasonic_trigger')).toBe(0)
  })

  it('🔴 ③ 微秒數不是 2／10 → 不摺，不准改學生的數字', () => {
    const tree = lift(sketch(TRIG('trigPin', '5', '15')))
    expect(count(tree, 'cpp:delay_microseconds')).toBe(2)      // ← 正向錨點
    expect(count(tree, 'cpp:ultrasonic_trigger')).toBe(0)
  })

  it('🔴 ④ 三次 digitalWrite 不是同一根腳 → 不摺', () => {
    const body =
      `  digitalWrite(trigPin, LOW);\n  delayMicroseconds(2);\n` +
      `  digitalWrite(echoPin, HIGH);\n  delayMicroseconds(10);\n  digitalWrite(trigPin, LOW);\n`
    const tree = lift(sketch(body))
    expect(count(tree, 'cpp:digital_write')).toBe(3)           // ← 正向錨點
    expect(count(tree, 'cpp:ultrasonic_trigger')).toBe(0)
  })

  it('🔴 ⑤ 語料實況：觸發摺起來，而【換算不摺】——摺什麼是數出來的', () => {
    const body =
      TRIG('trigPin') +
      `  long duration = pulseIn(echoPin, HIGH);\n  float distance = duration * 0.034 / 2;\n`
    const tree = lift(sketch(body))
    expect(count(tree, 'cpp:ultrasonic_trigger')).toBe(1)      // ← 摺了
    // 🔴 而換算那兩句**留成一般積木**——觸發＋換算緊鄰只有 9/14，沒資格摺
    expect(ids(tree)).toContain('cpp:pulse_read')
    expect(ids(tree)).toContain('cpp:arithmetic')
    expect(ids(tree)).not.toContain('cpp:raw_code')
  })

  it('generate —— 產回原本那五行，一個字不多', () => {
    const src = sketch(TRIG('trigPin'))
    const out = generateCode(lift(src), 'cpp', apcs as StylePreset)
    expect(out).toContain('digitalWrite(trigPin, LOW);')       // ← 正向錨點
    expect(out).toContain('delayMicroseconds(2);')
    expect(out).toContain('delayMicroseconds(10);')
    expect(out).toContain('digitalWrite(trigPin, HIGH);')
    expect((out.match(/digitalWrite\(trigPin, LOW\);/g) ?? []).length).toBe(2)
  })

  it('round-trip —— 兩趟身分與文字都不漂移', () => {
    const src = sketch(TRIG('trigPin') + `  long d = pulseIn(echoPin, HIGH);\n`)
    const one = lift(src)
    const gen1 = generateCode(one, 'cpp', apcs as StylePreset)
    const two = lift(gen1)
    const gen2 = generateCode(two, 'cpp', apcs as StylePreset)
    expect(count(two, 'cpp:ultrasonic_trigger')).toBe(1)       // ← 正向錨點
    expect(gen2).toBe(gen1)
  })

  it('execute —— 跑完之後觸發腳停在低電位（與那五句一致）', async () => {
    const i = new SemanticInterpreter({ maxSteps: 100_000 })
    await i.execute(lift(sketch(TRIG('trigPin'))))
    const pins = pinsOf(i as never)
    expect(pins.has(9)).toBe(true)                             // ← 正向錨點：真的碰到那根腳
    expect(pins.get(9)?.value).toBe(0)
  })
})
