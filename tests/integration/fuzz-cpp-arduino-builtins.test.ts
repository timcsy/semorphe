/**
 * fuzz（2026-08-18，第 0 批）抓到的**兩個 bug** 的回歸測試。
 *
 * ## 🔴 兩個都有同一個形狀：**單看一次轉換是對的**
 *
 * ```
 * ① 區塊註解每轉一次多一顆 `*`   → 只有轉【第二次】才看得見
 * ② `int a[] = {…}` 被補上大小    → 產出「編得過」，而語義變了
 * ```
 *
 * > **一個「每次都多一點」的錯誤，單看一次轉換是對的
 * > ——它只有在轉第二次的時候才看得見。**
 *
 * ## ⚠️ 而它們為什麼是被 fuzz 抓到，不是被既有測試
 *
 * 既有語料用 `//` 行註解、而且陣列都寫了大小。
 * **AI 生成的 sketch 幾乎都以 `/* … *\/` 開頭，而旋律陣列幾乎都不寫大小。**
 *
 * > **一批「我們自己寫的」語料，量到的是我們自己想得到的用法。**
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'

const S = apcs as unknown as StylePreset
let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})
const lift = (c: string): SemanticNode =>
  createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode
const gen = (t: SemanticNode): string => generateCode(t, 'cpp', S)

describe('fuzz 抓到的兩個 round-trip bug', () => {
  it('🔴 ① 區塊註解不得每轉一次就多一顆星號', () => {
    const src = `/*
 * HC-SR04 ultrasonic distance meter
 * Prints the distance to the Serial Monitor
 */
int main() { return 0; }
`
    const g1 = gen(lift(src))
    // ← 正向錨點：先證明註解真的被產出來了，否則下面的負向會空過
    expect(g1, '註解整個不見了 → 下面的斷言測不到東西').toContain('HC-SR04')
    const g2 = gen(lift(g1))
    expect(g2, '🔴 轉第二次就長出來了').toBe(g1)
    expect(g2).not.toContain('* *')
  })

  it('🔴 ② `int a[] = {…}` 的大小【不得】被編出來——那會改變 sizeof', () => {
    const src = 'int melody[] = {262, 294, 330, 349, 392, 440, 494, 523};\nint main() { return 0; }\n'
    const g1 = gen(lift(src))
    // ← 正向錨點
    expect(g1, '陣列整個不見了').toContain('melody')
    // 🔴 原本會產出 `int melody[10]`——而 sizeof(melody)/sizeof(melody[0]) 從 8 變 10，
    //    學生的旋律迴圈會多播兩個垃圾音。
    expect(g1, '🔴 大小被編出來了').toContain('int melody[]')
    expect(g1).not.toMatch(/melody\[\d+\]/)
    expect(gen(lift(g1)), '轉第二次漂移').toBe(g1)
  })

  it('⚠️ 而【有寫】大小的陣列不受影響（這條防過度修正）', () => {
    const src = 'int buf[16];\nint main() { return 0; }\n'
    const g1 = gen(lift(src))
    expect(g1).toContain('int buf[16]')
    expect(gen(lift(g1))).toBe(g1)
  })

  it('⚠️ 單行的 `/* … */` 也要穩定（剝除只該動多行的裝飾）', () => {
    const src = '/* one liner */\nint main() { return 0; }\n'
    const g1 = gen(lift(src))
    expect(g1).toContain('one liner')
    expect(gen(lift(g1))).toBe(g1)
  })

  it('⚠️ 註解內文裡的 `*` 不得被剝掉（乘法、指標）', () => {
    const src = `/*
 * area = w * h
 * see int* p
 */
int main() { return 0; }
`
    const g1 = gen(lift(src))
    expect(g1, '🔴 內文的星號被剝掉了').toContain('w * h')
    expect(g1).toContain('int* p')
    expect(gen(lift(g1))).toBe(g1)
  })
})
