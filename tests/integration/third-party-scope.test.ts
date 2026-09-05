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
import { ComponentRegistry } from '../../src/core/component-registry'
import type { ComponentDefJSON } from '../../src/core/types'

/** 一顆合成的第三方膠囊——⚠️ 它**不寫進檔案系統**，只走登錄那條路。 */
function thirdParty(id: string, extra: Partial<ComponentDefJSON> = {}): ComponentDefJSON {
  return {
    componentId: id,
    abstractComponent: null,
    properties: [],
    children: {},
    role: 'statement',
    ...extra,
  } as ComponentDefJSON
}

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
   * ⚠️ **登錄表裡那個欄位叫 `id`，不是 `componentId`**——
   * `ComponentDefJSON`（宣告）用後者，`ComponentDef`（執行期）用前者。
   *
   * 🔴 這一支第一版讀錯了，而它紅得像一個產品缺陷（「註冊之後拿不回來」）。
   * 那正是名詞表「`componentId` 那一列」在說的事：**同一個概念兩個欄位名**。
   *
   * > **一個概念在兩個型別上有兩個名字時，
   * > 讀錯的那一次會長得像那個東西壞了。**
   */
  describe('② 拿得到——登錄表認它', () => {
    it('註冊之後拿得回來', () => {
      const reg = new ComponentRegistry()
      reg.loadFromJSON([thirdParty('@someone:boost_vector')])
      expect(reg.get('@someone:boost_vector')?.id).toBe('@someone:boost_vector')
    })

    /** ⚠️ 兩個不同 scope 的**同名**元件不得互相蓋掉——那是 scope 存在的理由。 */
    it('🔴 不同 scope 的同名元件各自獨立', () => {
      const reg = new ComponentRegistry()
      reg.loadFromJSON([
        thirdParty('@alice:vector'),
        thirdParty('@bob:vector'),
        thirdParty('cpp:vector'),
      ])
      expect(reg.listAll().map((c) => c.id).sort())
        .toEqual(['@alice:vector', '@bob:vector', 'cpp:vector'])
    })
  })

  describe('③ 進得了抽象元件——那是「同一件事的不同實作」的機制', () => {
    /**
     * `concepts/元件.md` 逐字：**「`@someone:boost_vector` 宣告一條轉換邊
     * 就自動進同一個抽象元件」**。
     *
     * 🔴 而那句話的可檢查形式是：**抽象元件的查詢不看 scope**。
     * 一個「只認得內建 scope」的實作會讓第三方元件永遠是孤兒，
     * ⚠️ 而它在只有內建元件的時候完全正常。
     */
    it('第三方元件宣告了抽象元件 → 找得到同一個', () => {
      const reg = new ComponentRegistry()
      reg.loadFromJSON([
        thirdParty('cpp:vector', { abstractComponent: 'universal:sequence' }),
        thirdParty('@someone:boost_vector', { abstractComponent: 'universal:sequence' }),
        thirdParty('universal:sequence'),
      ])
      expect(reg.findAbstract('@someone:boost_vector')?.id).toBe('universal:sequence')
      expect(reg.findAbstract('cpp:vector')?.id).toBe('universal:sequence')
    })

    it('沒宣告抽象元件的第三方元件 → 不硬塞一個', () => {
      const reg = new ComponentRegistry()
      reg.loadFromJSON([thirdParty('@someone:thing')])
      expect(reg.findAbstract('@someone:thing')).toBeUndefined()
    })
  })
})
