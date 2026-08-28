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
import { allSkeletons } from '../../src/core/skeleton'
// ⚠️ 兩個語言的宣告都要載——`skeleton` 跨語言（Python 的目標指 `python-none`）
import '../../src/languages/cpp/skeletons'
import '../../src/languages/python/skeletons'
import { TargetRegistry } from '../../src/core/target-registry'
import cppTarget from '../../src/languages/cpp/targets/cpp.json'
import cTarget from '../../src/languages/cpp/targets/c.json'
import competitiveTarget from '../../src/languages/cpp/targets/cpp-advanced.json'
import arduinoTarget from '../../src/languages/cpp/targets/arduino.json'
import cppBeginner from '../../src/languages/cpp/topics/cpp-beginner.json'
import cBeginner from '../../src/languages/cpp/topics/c-beginner.json'
import cppAdvanced from '../../src/languages/cpp/topics/cpp-advanced.json'
import arduinoTopic from '../../src/languages/cpp/topics/arduino.json'
import apcsStyle from '../../src/languages/cpp/styles/apcs.json'
import cStyle from '../../src/languages/cpp/styles/c.json'
import competitiveStyle from '../../src/languages/cpp/styles/competitive.json'
import googleStyle from '../../src/languages/cpp/styles/google.json'
import type { Target } from '../../src/core/types'

const TARGETS = [cppTarget, cTarget, competitiveTarget, arduinoTarget] as Target[]

describe('目標', () => {
  let reg: TargetRegistry
  beforeEach(() => { reg = new TargetRegistry() })

  it('★ 登錄與查找', () => {
    for (const t of TARGETS) reg.register(t)
    expect(reg.get('c')?.style).toBe('c')
    expect(reg.all()).toHaveLength(4)
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
  it('★ 它不是新的抽象層——欄位是一個【封閉】的集合', () => {
    // 🔴 判準沒有變（SC-005）：**每個欄位都要說得出「它今天住在哪裡」**。
    //
    // ⚠️ 而斷言的形狀在 2026-08-18 改過一次：原本是「恰好等於四個」，
    //    那讓**選用欄位**不可能存在（`cpp.json` 沒有 `skeleton`，
    //    `arduino.json` 有 → 同一條 `toEqual` 不可能兩個都過）。
    //
    // 🟢 改成「必要的都在 ＋ 出現的都在白名單裡」——**多一個沒登記的仍然紅**，
    //    所以「不得長成新的抽象層」這條力道沒有掉。
    const REQUIRED = ['id', 'name', 'style', 'topic']
    // 每一格後面那句話就是 SC-005 要的「它今天住在哪裡」。
    const ALLOWED: Record<string, string> = {
      id: '標籤',
      name: '標籤',
      topic: '引用——課程清單',
      style: '引用——風格',
      // 🔴 `skeleton` **不是新機制，是替一個既有的寫死決定命名**：
      //    它今天住在 `languages/cpp/cpp-scaffold.ts` 的常數 `'int main() {'`
      //    與 `languages/cpp/auto-include.ts` 補丁器的第 3 步。
      //    ⚠️ 而那兩處**各自實作了同一個決定**，所以 Arduino 的 sketch 被包進
      //    `int main()`——修好一處時症狀只少一半。命名它是為了讓兩處問同一份宣告。
      skeleton: '引用——程式外殼（原本寫死在鷹架與補丁器兩處）',
      // 🔴 這四格是**選單的宣告**（2026-08-28）。使用者看著那份 13 項的
      //    平清單問「這邊能不能重新設計整理一下？」，而它混著兩個軸
      //    （語言／軌道 vs 板子）。
      //    ⚠️ 它們住在這裡而不是 UI，理由與 `skeleton` 相同：
      //    **推導會把例外歸錯組**——`arduino`（不指定板子）是硬體卻沒有板子。
      group: '標籤——選單分組（程式語言／硬體）',
      order: '標籤——組內順序（教學順序，不是註冊順序）',
      listed: '標籤——要不要列在目標選單（false ＝ 只由課程進得去）',
      hint: '標籤——選單上的淡色說明（今天只有「沒有板子常數」那一個陷阱）',
      // 🔴 `_..._why` 是這個 repo 既有的慣例：一個決定的理由住在它旁邊
      _name_why: '註解——為什麼叫這個名字',
    }
    for (const t of TARGETS) {
      const keys = Object.keys(t)
      for (const r of REQUIRED) {
        expect(keys, `🔴 目標 ${(t as { id: string }).id} 少了必要欄位 ${r}`).toContain(r)
      }
      for (const k of keys) {
        expect(
          ALLOWED[k],
          `🔴 目標 ${(t as { id: string }).id} 多了一個沒登記的欄位 \`${k}\`\n` +
            `——而那讓它從【組合】變成【新的抽象層】。\n` +
            `判準（SC-005）：每個欄位都要說得出「它今天住在哪裡」。\n` +
            `⚠️ 要加的話，把答案寫進這支測試的 ALLOWED 裡；寫不出來就不要加。\n` +
            `⚠️ 而 provides／reference 是【完整設計的另外兩格，本輪沒做】——` +
            `加它們之前要先讀 draft/2026-08-13-C和C++難分難捨.md§三。`,
        ).toBeTruthy()
      }
    }
  })

  it('★ 而 `skeleton` 要指得到一份【真的登記過】的骨架', () => {
    // 🔴 **值域是開放的**（2026-08-28）。這一支原本寫死 `['main', 'none']`
    //    ——也就是「有」跟「沒有」，而那正是骨架宣告化要拆掉的東西。
    //
    //    使用者：「我希望 Arduino 系列也有腳手架」→ 九個板子目標從 `'none'`
    //    （＝沒有骨架）改指 `'arduino'`（兩個進入點 `setup`／`loop`）。
    //
    // > **一個把值域寫死成清單的測試，會在第三種值出現的那天擋住它
    // > ——而那時它看起來像「你改壞了」。**
    //
    // 🟢 改成問登記處：**新增一份骨架只要多一個 JSON，這一支不必動**；
    //    而打錯一個 id 仍然紅。
    const known = [...allSkeletons().keys()]
    expect(known.length, '🔴 一份骨架都沒登記 → 語言套件沒載入，這一支不算數').toBeGreaterThanOrEqual(2)
    for (const t of TARGETS) {
      const v = (t as { skeleton?: string }).skeleton
      if (v === undefined) continue
      expect(
        known,
        `🔴 ${(t as { id: string }).id} 的 skeleton 是 \`${v}\`，而沒有這一份骨架`,
      ).toContain(v)
    }
  })

  it('★ 而那兩個引用要指得到【真的存在】的東西', () => {
    const topics = new Set([cppBeginner, cBeginner, cppAdvanced, arduinoTopic].map((t) => (t as { id: string }).id))
    const styles = new Set([apcsStyle, cStyle, competitiveStyle, googleStyle].map((s) => (s as { id: string }).id))
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
