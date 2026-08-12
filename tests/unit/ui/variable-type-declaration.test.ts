/**
 * 「這個概念宣告的是哪一種變數」——一個事實，兩個消費者（063）
 *
 * ## 為什麼需要這支
 *
 * 這個事實原本被**寫死了兩次**，在兩個不同的檔案裡：
 *
 * | 消費者 | 原本怎麼寫的 |
 * |---|---|
 * | 同步控制器的降級 | `node.conceptId === 'cpp_string_declare' ? 'string' : undefined` |
 * | 積木註冊處的下拉選單 | `if (block.type === 'cpp_string_declare')` |
 *
 * 兩處都**只認得那一個概念**。而危險的地方是：加一個同類概念（例如另一種
 * 字串型別）時，**兩處都不會有任何提示**——下拉選單少一個選項，使用者只會
 * 覺得「怎麼選不到」，而測試全綠。
 *
 * 所以這支釘的是**宣告鏈本身**，不是某一次的輸出。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { registerCppLanguage } from '../../../src/languages/cpp/generators'
import {
  variableTypeOf,
  conceptsDeclaringVariableType,
} from '../../../src/core/language-executors'
import { allVariableDropdownBlocks } from '../../../src/core/variable-dropdown-blocks'

beforeAll(() => {
  registerCppLanguage()
})

describe('變數型別宣告：語言套件推、核心讀', () => {
  it('★ 宣告真的被推進來了——沒有的話下面兩支會因為「兩邊都空」而假通過', () => {
    expect(
      variableTypeOf('cpp:string_declare'),
      'concepts.json 的 declaresVariableType 沒有被推進核心。' +
        '下拉選單會變成空的，而使用者只會覺得「怎麼選不到字串變數」——測試全綠。',
    ).toBe('string')
  })

  it('★ 反查得到——下拉選單靠的是這個方向', () => {
    expect(conceptsDeclaringVariableType('string')).toContain('cpp:string_declare')
  })

  it('★ 沒宣告的概念不得被誤認——「什麼都回報」也能通過上面兩支', () => {
    expect(variableTypeOf('cpp:var_declare')).toBeUndefined()
    expect(conceptsDeclaringVariableType('string')).not.toContain('cpp:var_declare')
    expect(conceptsDeclaringVariableType('__no_such_type__')).toEqual([])
  })

  it('★ 加一個同類概念時，兩個消費者都要自動涵蓋它', () => {
    // 這一支是本功能的重點：宣告是**開放**的，不是一份寫死的清單。
    // 它證明「再多一個字串宣告概念」不需要改任何消費者的程式碼。
    const existing2 = conceptsDeclaringVariableType('string')
    expect(existing2.length).toBeGreaterThan(0)
    expect(
      existing2.every((c) => variableTypeOf(c) === 'string'),
      '反查與正查不一致——兩個消費者會看到不同的答案',
    ).toBe(true)
  })
})

describe('有工作區下拉選單的積木：名單由語言套件宣告（064）', () => {
  /**
   * 這一類積木**沒辦法用純 JSON 定義**——欄位的選項要從即時工作區算出來。
   * 建構程式碼住在介面層是對的（那是 Blockly 的機制），但「哪些積木要用它」
   * 原本也寫死在介面層：`Blockly.Blocks['cpp_string_at'] = { … }`。
   *
   * ⚠️ **空清單與「介面層沒接上」產出完全一樣**——兩者都是積木沒被註冊，
   * 而那只有真的開啟編輯器才看得到。所以這支釘的是宣告本身。
   */
  it('★ 名單不是空的——空的話介面層什麼都不會註冊，而測試不會知道', () => {
    expect(
      allVariableDropdownBlocks().length,
      '語言套件沒有推任何宣告。介面層會跑一個空迴圈，那些積木不會被註冊，' +
        '使用者開啟編輯器才會看到「未知積木」。',
    ).toBeGreaterThan(0)
  })

  it('★ 每一筆的變數型別都必須有概念真的宣告它', () => {
    for (const d of allVariableDropdownBlocks()) {
      expect(
        conceptsDeclaringVariableType(d.variableType).length,
        `${d.blockType} 的下拉選單要列 ${d.variableType} 變數，` +
          `但**沒有任何概念宣告自己是 ${d.variableType}**——選單會永遠是空的。`,
      ).toBeGreaterThan(0)
    }
  })

  it('★ 欄位名與值輸入名都不得是空的', () => {
    for (const d of allVariableDropdownBlocks()) {
      expect(d.field, `${d.blockType} 沒有下拉欄位名`).toBeTruthy()
      expect(d.valueInput, `${d.blockType} 沒有值輸入名`).toBeTruthy()
    }
  })
})
