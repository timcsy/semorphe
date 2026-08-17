/**
 * **目標（target）**——把「哪些概念看得到」與「產出什麼形狀」綁成一個具名組合。
 *
 * ## 🔴 而本檔最重要的一支是「它不是新的抽象層」
 *
 * spec US2：目標**綁的全是既有欄位**。而這個專案有前例——
 * 「機制有了沒人接上」發生過**五次**，**一個新層會帶來第六次**。
 *
 * 判準（spec SC-005）：**目標的每一個欄位都說得出「它今天住在哪裡」**
 * ——說不出來的即為新機制。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { TargetRegistry } from '../../src/core/target-registry'
import cppTarget from '../../src/languages/cpp/targets/cpp.json'
import cTarget from '../../src/languages/cpp/targets/c.json'
import competitiveTarget from '../../src/languages/cpp/targets/cpp-competitive.json'
import cppBeginner from '../../src/languages/cpp/topics/cpp-beginner.json'
import cBeginner from '../../src/languages/cpp/topics/c-beginner.json'
import cppCompetitive from '../../src/languages/cpp/topics/cpp-competitive.json'
import apcsStyle from '../../src/languages/cpp/styles/apcs.json'
import cStyle from '../../src/languages/cpp/styles/c.json'
import competitiveStyle from '../../src/languages/cpp/styles/competitive.json'
import type { Target } from '../../src/core/types'

const TARGETS = [cppTarget, cTarget, competitiveTarget] as Target[]

describe('目標', () => {
  let reg: TargetRegistry
  beforeEach(() => { reg = new TargetRegistry() })

  it('★ 登錄與查找', () => {
    for (const t of TARGETS) reg.register(t)
    expect(reg.get('c')?.style).toBe('c')
    expect(reg.all()).toHaveLength(3)
  })

  it('★ 重複的 id 要出聲，不得靜默覆蓋', () => {
    reg.register(TARGETS[0])
    expect(() => reg.register(TARGETS[0])).toThrow(/Duplicate/)
  })

  /**
   * 🔴 **這一支是 spec US2 的執行機構。**
   *
   * ⚠️ 它**不是**「檢查有四個欄位」——那樣加第五個欄位它照樣綠。
   * 它斷言的是**欄位的集合恰好等於**那四個，**而多一個就紅**。
   */
  it('★ 它不是新的抽象層——欄位【恰好】是兩個引用兩個標籤', () => {
    for (const t of TARGETS) {
      expect(
        Object.keys(t).sort(),
        `🔴 目標多了一個欄位——而那讓它從【組合】變成【新的抽象層】。\n` +
          `判準（SC-005）：每個欄位都要說得出「它今天住在哪裡」。\n` +
          `  id／name → 標籤　topic → 課程清單　style → 風格\n` +
          `⚠️ 而 provides／reference 是【完整設計的另外兩格，本輪沒做】——` +
          `加它們之前要先讀 draft/2026-08-13-C和C++難分難捨.md§三。`,
      ).toEqual(['id', 'name', 'style', 'topic'])
    }
  })

  it('★ 而那兩個引用要指得到【真的存在】的東西', () => {
    const topics = new Set([cppBeginner, cBeginner, cppCompetitive].map((t) => (t as { id: string }).id))
    const styles = new Set([apcsStyle, cStyle, competitiveStyle].map((s) => (s as { id: string }).id))
    for (const t of TARGETS) {
      expect(topics.has(t.topic), `🔴 目標 ${t.id} 指向不存在的課程清單 ${t.topic}`).toBe(true)
      expect(styles.has(t.style), `🔴 目標 ${t.id} 指向不存在的風格 ${t.style}`).toBe(true)
    }
  })

  it('★ 每個目標指向【不同的】風格——否則它什麼都沒綁', () => {
    const styles = TARGETS.map((t) => t.style)
    expect(new Set(styles).size, '🔴 有兩個目標綁到同一個風格').toBe(styles.length)
  })

  /**
   * 🔴 **本輪（spec 136）新增的一支：課程清單也要不同。**
   *
   * spec 134 的第一刀兩筆目標**綁到同一個課程清單**，於是 SC-001
   * （「選一次而不是三次」）**只兌現了三分之一**——資料上成立，效果上是零。
   *
   * > **一個「綁定」如果兩邊綁的是同一個值，它在資料上成立，而在效果上是零。**
   */
  it('★ 每個目標指向【不同的】課程清單——否則「選一次」只兌現三分之一', () => {
    const topics = TARGETS.map((t) => t.topic)
    expect(
      new Set(topics).size,
      '🔴 有兩個目標綁到同一個課程清單——那是 spec 134 沒兌現 SC-001 的原因。',
    ).toBe(topics.length)
  })
})
