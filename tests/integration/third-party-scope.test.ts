/**
 * **第三方 scope（`@someone:*`）——裝得進來、拿得到、認得出。**
 *
 * ## 🔴 它回答的是一條驗收，而做法是「先驗，再決定」
 *
 * vision「元件套件管理」的第二個驗收逐字：
 *
 * > 驗收：第三方 scope（`@someone:*`）的元件**裝得進來、拿得到、認得出**
 * > 🟢 命名那一半**已經設計完了**（`concepts/元件.md:138`：scope 是套件擁有者，
 * > 而 `@someone:boost_vector` 宣告一條轉換邊就自動進同一個抽象元件）
 *
 * 而「設計完了」與「試過了」是兩件事。這一支去試。
 *
 * > **一個設計如果沒有人用它的極端值跑過一次，
 * > 那它成立的範圍是【設計者想像的那些輸入】。**
 *
 * ## ⚠️ 它不做的
 *
 * - **不做安裝機制**——「裝得進來」的完整形式（npm 套件、依賴解析）
 *   是階段 8。這裡驗的是**身分與登錄那一層**：
 *   一顆帶 `@` 的膠囊放進來之後，系統認不認得它
 * - **不改任何產品程式碼**（除非發現缺陷）——它是一次查證
 */
import { describe, it, expect } from 'vitest'
import { idToDir } from '../../src/core/component/types'
import { isValidComponentId } from '../../src/core/identity'
import { declareAbstract, abstractComponentOf } from '../../src/core/language-executors'

describe('第三方 scope：`@someone:*`', () => {
  describe('① 認得出——身分與路徑的換算', () => {
    it('`@someone:boost_vector` → `@someone/boost_vector`', () => {
      expect(idToDir('@someone:boost_vector')).toBe('@someone/boost_vector')
    })

    /**
     * ⚠️ **`@` 不是分隔符，`:` 才是**——一個把 `@` 當成特殊字元的實作
     * 會在這裡把 scope 切錯，而它在既有的 `cpp:`／`python:` 上完全看不出來。
     */
    it('scope 裡的 `@` 不影響切點', () => {
      expect(idToDir('@a:b')).toBe('@a/b')
      expect(idToDir('cpp:for_loop')).toBe('cpp/for_loop')
      // 名字裡有冒號時**切第一個**——scope 不含冒號是那條規矩的另一面
      expect(idToDir('@ns:a:b')).toBe('@ns/a:b')
    })

    it('🔴 沒有冒號要丟錯，不得猜一個 scope', () => {
      expect(() => idToDir('boost_vector')).toThrow(/<scope>:<name>/)
    })
  })

  /**
   * 🔴 2026-10-31 改寫：② ③ 原本驗的是 `core/component-registry.ts` 的 `ComponentRegistry`，
   * 而產品從不載入它——**護欄驗的是一條產品不走的路**。改驗產品真正用的兩道：
   * 載入膠囊時的身分檢查（`registry.ts` 的 C1 ＝ `isValidComponentId`），與抽象元件的查詢
   *（`declareAbstract`／`abstractComponentOf`，由 `cpp/generators/index.ts` 從 component.json 灌入）。
   */
  describe('② 進得了門——產品載入膠囊時的身分檢查認它', () => {
    it('`@someone:boost_vector` 是合法身分', () => {
      expect(isValidComponentId('@someone:boost_vector')).toBe(true)
      expect(isValidComponentId('cpp:vector')).toBe(true)
    })

    it('🔴 但名字裡再有冒號、或 scope 不是小寫識別字，就不是', () => {
      expect(isValidComponentId('@ns:a:b')).toBe(false)
      expect(isValidComponentId('Cpp:vector')).toBe(false)
      expect(isValidComponentId('@:x')).toBe(false)
    })
  })

  describe('③ 進得了抽象元件——那是「同一件事的不同實作」的機制', () => {
    /**
     * `concepts/元件.md` 逐字：**「`@someone:boost_vector` 宣告一條轉換邊
     * 就自動進同一個抽象元件」**。可檢查的形式是：**抽象元件的查詢不看 scope**。
     */
    it('第三方元件宣告了抽象元件 → 找得到同一個', () => {
      declareAbstract('@someone:boost_vector', 'universal:sequence')
      expect(abstractComponentOf('@someone:boost_vector')).toBe('universal:sequence')
    })

    it('沒宣告抽象元件的第三方元件 → 不硬塞一個', () => {
      expect(abstractComponentOf('@someone:thing')).toBeUndefined()
    })
  })
})
