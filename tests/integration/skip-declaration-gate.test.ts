/**
 * 宣告的門檻（US1）
 *
 * ## 為什麼宣告需要門檻
 *
 * 「這個概念刻意不執行」這句宣告會讓兩條護欄的數字同時下降，**而不改變任何
 * 一行執行行為**。所以它是最划算、也最危險的一種修改：
 *
 * > 如果一個概念其實是「還沒實作、只是做成空的」，把它宣告成「刻意不執行」
 * > 就是**把缺陷洗成設計**——而且洗完之後，護欄會替它背書。
 *
 * 實測 34 個候選裡只有 **12 個**站得住（見
 * `specs/053-declare-noop-execute/classification.md`）。天真的做法會宣告 31 個。
 *
 * 這支測試是那個門檻的機械化版本。
 */
import { describe, it, expect } from 'vitest'
import { allComponentDefs } from '../helpers/component-scan'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import type { PathName } from '../../src/core/types'

const REASONS = new Set(['declarative', 'consumed-by-parent'])

describe('宣告的門檻：說不出理由的不准宣告', () => {
  it('有 skipPaths 就必須有對應的 skipReasons', () => {
    const 缺理由: string[] = []
    for (const def of allComponentDefs()) {
      for (const p of def.skipPaths ?? []) {
        if (!def.skipReasons?.[p as PathName]) 缺理由.push(`${def.conceptId} 的 ${p}`)
      }
    }
    expect(
      缺理由,
      '以下宣告說不出理由——沒有理由的宣告是把缺陷洗成設計：\n  ' + 缺理由.join('\n  '),
    ).toEqual([])
  })

  it('理由只能是那兩個值——第三個值是在替「還沒做」找體面的名字', () => {
    const 壞理由: string[] = []
    for (const def of allComponentDefs()) {
      for (const [p, r] of Object.entries(def.skipReasons ?? {})) {
        if (!REASONS.has(String(r))) 壞理由.push(`${def.conceptId} 的 ${p}：「${r}」`)
      }
    }
    expect(壞理由, `不認得的理由：${壞理由.join('、')}`).toEqual([])
  })

  it('沒有 skipPaths 卻寫了 skipReasons —— 孤兒理由', () => {
    const 孤兒: string[] = []
    for (const def of allComponentDefs()) {
      const declared = new Set(def.skipPaths ?? [])
      for (const p of Object.keys(def.skipReasons ?? {})) {
        if (!declared.has(p as PathName)) 孤兒.push(`${def.conceptId} 的 ${p}`)
      }
    }
    expect(孤兒).toEqual([])
  })

  it('★ 宣告不執行的概念，不得同時註冊「會做事」的執行器（矛盾偵測）', async () => {
    const interp = new SemanticInterpreter({ maxSteps: 100 })
    const 矛盾: string[] = []
    for (const def of allComponentDefs()) {
      if (!(def.skipPaths ?? []).includes('execute')) continue
      const ex = interp.getExecutor(def.conceptId)
      if (!ex) continue
      // 空操作的函式原始碼很短且沒有 body 內容；會做事的不是
      const src = ex.toString().replace(/\s+/g, '')
      const isNoop = /^async\(?\)?=>\{\}$/.test(src) || /=>\{\}$/.test(src)
      if (!isNoop) 矛盾.push(`${def.conceptId}（宣告不執行，卻註冊了會做事的執行器）`)
    }
    expect(矛盾, 矛盾.join('\n  ')).toEqual([])
  })

  it('★ 判為「還沒實作」的概念沒有偷偷拿到宣告', () => {
    // classification.md 判定不得宣告的那些。這支測試是那份判定的釘子——
    // 有人日後想讓數字好看，最省事的做法就是給它們一個 skipPaths。
    const 不得宣告 = [
      'cpp_class_def', 'cpp_struct_declare', 'cpp_constructor', 'cpp_destructor',
      'cpp_virtual_method', 'cpp_override_method', 'cpp_pure_virtual',
      'cpp_operator_overload', 'cpp_lambda', 'cpp_namespace_def',
      'cpp_ifdef', 'cpp_ifndef',
      'cpp_raw_code', 'cpp_raw_expression', 'cpp_include_local',
    ]
    const 偷渡 = allComponentDefs()
      .filter((d) => 不得宣告.includes(d.conceptId) && (d.skipPaths ?? []).includes('execute'))
      .map((d) => d.conceptId)
    expect(
      偷渡,
      '以下概念實測會產生錯誤的執行結果（或根本測不到），不得宣告成「刻意不執行」：\n  ' +
        偷渡.join('、') +
        '\n見 specs/053-declare-noop-execute/classification.md',
    ).toEqual([])
  })

  it('★ 對照組：該宣告的 12 個確實都宣告了（證明門檻不是靠「大家都沒宣告」而通過）', () => {
    const 應宣告 = [
      'comment', 'block_comment', 'doc_comment', 'cpp_include', 'cpp_using_namespace',
      'cpp_define', 'cpp_stringstream_declare', 'cpp_ifstream_declare',
      'cpp_ofstream_declare', 'cpp_pair_declare', 'cpp_case', 'cpp_default',
    ]
    const 漏掉 = 應宣告.filter((id) => {
      const d = allComponentDefs().find((x) => x.conceptId === id)
      return !d || !(d.skipPaths ?? []).includes('execute')
    })
    expect(漏掉, `這些通過了實測卻沒拿到宣告：${漏掉.join('、')}`).toEqual([])
  })
})
