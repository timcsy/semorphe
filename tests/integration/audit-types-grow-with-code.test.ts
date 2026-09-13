/**
 * **第一百一十一條護欄：型別的下拉跟著程式長。**
 *
 * ## 🔴 它守的是「我宣告過的型別，我選不到」
 *
 * vision「開放值域的欄位要寫得出來」最後一條驗收，逐字：
 *
 * > 驗收：選項跟著程式長——用過的型別會出現在其他積木的下拉裡
 * > （**導出的，不是宣告的**）
 *
 * ⚠️ **而它不是一個正確性的 bug**：那個型別打字寫得出來
 * （`dynamic-dropdown-field` 早就「認不得的值不會被換掉」）。
 * 壞的是**可發現性**。
 *
 * ## 本護欄不檢測什麼
 *
 * - **不管 `vector<int>` 這種整串的型別名**——那一層的資訊住在身分裡
 *   （`cpp:vector_declare`），而掃 `type` 拿到的是元素型別。刻意的界線。
 * - **不管從標頭來的型別**——那要真的解析 `#include`
 * - 🔴 **不替使用者修掉錯字**——見下面那一條反向測試。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  typesInUse,
  withTypesInUse,
  setTreeForTypeLookup,
  typesInCurrentProgram,
} from '../../src/core/types-in-use'
import type { SemanticNode } from '../../src/core/types'
import { REPO_ROOT } from '../helpers/guardrail'

/** 一棵最小的樹——⚠️ 刻意不經解析器，這一支驗的是**列舉**不是解析。 */
function node(componentId: string, type?: string, slots: Record<string, SemanticNode[]> = {}): SemanticNode {
  return { id: componentId + Math.random(), componentId, properties: type ? { type } : {}, slots } as SemanticNode
}

/** 今天那七個——🔴 **順序是介面的一部分**（課程在依賴它）。 */
const BUILTIN: Array<[string, string]> = [
  ['int', 'int'], ['float', 'float'], ['double', 'double'],
  ['char', 'char'], ['bool', 'bool'], ['string', 'string'], ['long long', 'long long'],
]

describe('第一百一十一條護欄：型別的下拉跟著程式長', () => {
  beforeEach(() => setTreeForTypeLookup(null))

  describe('列舉：這支程式用過哪些型別', () => {
    it('SC-001／SC-002：自訂型別與多字型別都掃得到', () => {
      const tree = node('program', undefined, {
        body: [node('cpp:var_declare', 'Point'), node('cpp:var_declare', 'unsigned int')],
      })
      expect(typesInUse(tree)).toEqual(['Point', 'unsigned int'])
    })

    it('同一個型別用很多次 → 只出現一次，而順序是它第一次出現的位置', () => {
      const tree = node('program', undefined, {
        body: [node('cpp:var_declare', 'int'), node('cpp:var_declare', 'Point'), node('cpp:var_declare', 'int')],
      })
      expect(typesInUse(tree)).toEqual(['int', 'Point'])
    })

    it('深層的節點也掃得到——⚠️ 型別多半宣告在函式裡，不在最外層', () => {
      const tree = node('program', undefined, {
        body: [node('cpp:func_def', undefined, { body: [node('cpp:var_declare', 'Point')] })],
      })
      expect(typesInUse(tree)).toEqual(['Point'])
    })

    it('空樹／null → 空陣列，不得爆', () => {
      expect(typesInUse(null)).toEqual([])
      expect(typesInUse(undefined)).toEqual([])
      expect(typesInUse(node('program'))).toEqual([])
    })
  })

  describe('🔴 SC-003 零回歸：內建那幾個一格不動', () => {
    it('沒用過自訂型別 → 逐字等於今天那七個，順序相同', () => {
      const tree = node('program', undefined, { body: [node('cpp:var_declare', 'int')] })
      expect(withTypesInUse(BUILTIN, typesInUse(tree))).toEqual(BUILTIN)
    })

    it('空程式 → 等於內建清單，**不得是空的**', () => {
      expect(withTypesInUse(BUILTIN, [])).toEqual(BUILTIN)
    })

    it('用了自訂型別 → 內建的仍在原來的位置，自訂的排在後面', () => {
      const out = withTypesInUse(BUILTIN, ['Point', 'int', 'unsigned int'])
      expect(out.slice(0, 7)).toEqual(BUILTIN)
      expect(out.slice(7)).toEqual([['Point', 'Point'], ['unsigned int', 'unsigned int']])
    })
  })

  describe('SC-004：三個型別下拉都跟著長', () => {
    /**
     * ⚠️ 這一條讀的是**原始碼**，因為下拉的來源是在模組載入時宣告的
     * ——而「宣告時就決定了」正是這一刀要改掉的東西。
     */
    it('🔴 硬性零：三份型別來源，沒包上「∪ 用過的」的 = 0', () => {
      const src = fs.readFileSync(path.join(REPO_ROOT, 'src/languages/cpp/pack.ts'), 'utf8')
      const bad: string[] = []
      for (const name of ['cpp_var_types', 'cpp_return_types', 'cpp_param_types']) {
        const i = src.indexOf(`declareDropdownSource('${name}'`)
        expect(i, `🔴 找不到 ${name}——它改名了，而這條護欄正在空過`).toBeGreaterThan(-1)
        if (!src.slice(i, i + 200).includes('withTypesInUse')) bad.push(name)
      }
      expect(
        bad,
        '🔴 有型別下拉還是**宣告的**——它描述的是【我們想到的】，\n'
          + '   不是【這支程式裡有的】。學生宣告過的型別在那裡選不到。',
      ).toEqual([])
    })
  })

  describe('SC-005／SC-006：它住在核心，而它讀語義結構', () => {
    it('★ 核心純淨：列舉那一支裡，語言的型別名出現次數 = 0', () => {
      const src = fs.readFileSync(path.join(REPO_ROOT, 'src/core/types-in-use.ts'), 'utf8')
      const code = src.split('\n')
        .filter((l) => { const t = l.trim(); return !t.startsWith('*') && !t.startsWith('//') && !t.startsWith('/*') })
        .join('\n')
        // ⚠️ `typeof x === 'string'` 是 **TypeScript 的**型別，不是 C++ 的
        // ——🔴 而這條護欄第一次寫出來時就誤傷了它。
        //
        // > **一條「不准出現這個字」的護欄，
        // > 要先扣掉那個字在【另一個語言裡】的合法用法。**
        .replace(/typeof\s+\w+\s*[=!]==\s*'[a-z]+'/g, '')
      for (const t of ['int', 'float', 'double', 'char', 'bool', 'string']) {
        expect(code.includes(`'${t}'`) || code.includes(`"${t}"`),
          `🔴 列舉那一支裡出現了 C++ 的型別名 ${t}——「C++ 有哪些內建型別」不是核心的知識`).toBe(false)
      }
    })

    /**
     * 🔴 **這是 SC-006。**
     *
     * > **重新解析程式碼會是第二個真相**：同一份程式兩個地方各解一次，
     * > 而它們遲早會不一樣。
     */
    it('★ 它不解析程式碼——沒有解析器、沒有正規表示式吃字串', () => {
      const src = fs.readFileSync(path.join(REPO_ROOT, 'src/core/types-in-use.ts'), 'utf8')
      const code = src.split('\n')
        .filter((l) => { const t = l.trim(); return !t.startsWith('*') && !t.startsWith('//') && !t.startsWith('/*') })
        .join('\n')
      for (const forbidden of ['tree-sitter', 'TreeSitter', 'parse(', '.match(', 'RegExp']) {
        expect(code.includes(forbidden),
          `🔴 列舉那一支碰了 ${forbidden}——它必須讀語義結構，\n`
            + '   而重新解析程式碼會是【第二個真相】').toBe(false)
      }
    })
  })

  describe('餵樹的那一端', () => {
    it('沒有人餵過 → 空的，而消費端因此拿到內建清單（安全的那一邊）', () => {
      expect(typesInCurrentProgram()).toEqual([])
      expect(withTypesInUse(BUILTIN, typesInCurrentProgram())).toEqual(BUILTIN)
    })

    it('餵了之後讀得到', () => {
      setTreeForTypeLookup(node('program', undefined, { body: [node('cpp:var_declare', 'Point')] }))
      expect(typesInCurrentProgram()).toEqual(['Point'])
    })

    /**
     * ★ **組裝點真的餵了**——⚠️ 這一條讀原始碼，因為那一行不在任何
     * 單元測試會走到的路上，而**沒有它整條功能是死的**。
     */
    it('★ 組裝點在語義更新時餵了樹', () => {
      const src = fs.readFileSync(path.join(REPO_ROOT, 'src/ui/app.ts'), 'utf8')
      expect(
        src.includes('setTreeForTypeLookup'),
        '🔴 沒有人餵樹 → 下拉永遠只有內建清單，而**每一條單元測試照樣綠**\n'
          + '   ——那正是這條護欄存在的理由。',
      ).toBe(true)
    })
  })

  // ─── 注入（第四十九條） ───

  it('★ 注入：一份沒包上「∪ 用過的」的來源 → 抓得到', () => {
    const fake = `declareDropdownSource('cpp_var_types', () => [['int','int']])`
    const i = fake.indexOf(`declareDropdownSource('cpp_var_types'`)
    expect(fake.slice(i, i + 200).includes('withTypesInUse')).toBe(false)
  })

  /**
   * ★ **反向：打錯字的型別照樣進下拉。**
   *
   * 🔴 系統**分不出**「打錯字」與「還沒宣告的自訂型別」，而猜錯的代價不對稱：
   * 漏掉一個真的型別 → 學生選不到（那正是今天的 bug）；多一個錯字 → 多一列。
   *
   * > **一個會替使用者修正錯字的清單，
   * > 會在它猜錯的時候把真的東西藏起來。**
   */
  it('★ 反向：打錯字的型別（`itn`）照樣進——刻意的', () => {
    const tree = node('program', undefined, { body: [node('cpp:var_declare', 'itn')] })
    expect(typesInUse(tree)).toEqual(['itn'])
    expect(withTypesInUse(BUILTIN, ['itn']).at(-1)).toEqual(['itn', 'itn'])
  })
})
