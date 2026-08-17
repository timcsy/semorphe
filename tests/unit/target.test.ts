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
import cppBeginner from '../../src/languages/cpp/topics/cpp-beginner.json'
import apcsStyle from '../../src/languages/cpp/styles/apcs.json'
import cStyle from '../../src/languages/cpp/styles/c.json'
import type { Target } from '../../src/core/types'

const TARGETS = [cppTarget, cTarget] as Target[]

describe('目標', () => {
  let reg: TargetRegistry
  beforeEach(() => { reg = new TargetRegistry() })

  it('★ 登錄與查找', () => {
    for (const t of TARGETS) reg.register(t)
    expect(reg.get('c')?.style).toBe('c')
    expect(reg.all()).toHaveLength(2)
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
    const topics = new Set([(cppBeginner as { id: string }).id])
    const styles = new Set([(apcsStyle as { id: string }).id, (cStyle as { id: string }).id])
    for (const t of TARGETS) {
      expect(topics.has(t.topic), `🔴 目標 ${t.id} 指向不存在的課程清單 ${t.topic}`).toBe(true)
      expect(styles.has(t.style), `🔴 目標 ${t.id} 指向不存在的風格 ${t.style}`).toBe(true)
    }
  })

  it('★ 兩個目標要指向【不同的】風格——否則它什麼都沒綁', () => {
    expect(cppTarget.style).not.toBe(cTarget.style)
  })
})
