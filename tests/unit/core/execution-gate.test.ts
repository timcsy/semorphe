/**
 * **執行閘門：語法錯誤的樹不該跑得起來。**
 *
 * ## 它從哪來
 *
 * 使用者逐字：「**寫錯還能順利執行就是不合理的**」。而實測證實：
 *
 * ```
 * 少分號（下一行 cout）    標記 1  →  丟錯，而訊息是「變數 x 未宣告」🔴 誤導
 * 少分號（下一行 return）  標記 0  →  跑完，輸出 ""
 * 大括號沒關               標記 0  →  跑完，輸出 "1"
 * 亂碼 @@@                 標記 1  →  跑完，輸出 "1"
 * ```
 *
 * `degradationCause` 是 **metadata，不是閘門**——沒有任何東西讀它決定要不要跑。
 *
 * ## ✅ 而辨識層 2026-08-14（spec `121`）補齊了
 *
 * 上表是 `120` 當時的狀態。`121` 之後三種漏分號 ＋ 少右大括號全部認得，
 * 而**閘門一行沒改**——那正是「瓶頸在辨識層不在閘門」的證明。
 *
 * ⚠️ 而限定沒有消失，只是換了範圍：**認得的是解析器認得的**。
 *
 * ## 🔴 而最重要的一條是負向的
 *
 * `unsupported`／`nonstandard_but_valid` 是**我們**的問題（程式是對的），
 * **必須放行**。擋掉它們的話，我們的極限會變成使用者的錯誤。
 */
import { describe, it, expect } from 'vitest'
import { canExecute } from '../../../src/core/diagnostics'
import type { SemanticNode } from '../../../src/core/types'

function node(
  id: string,
  cause?: 'syntax_error' | 'unsupported' | 'nonstandard_but_valid',
  children: Record<string, SemanticNode[]> = {},
): SemanticNode {
  return {
    id,
    conceptId: 'cpp:var_declare',
    properties: {},
    children,
    ...(cause ? { metadata: { degradationCause: cause, rawCode: 'x' } } : {}),
  } as SemanticNode
}

describe('canExecute：語法錯誤的樹不該跑', () => {
  it('★ 正向錨點：一棵乾淨的樹可以跑（先證明量得到「可以」）', () => {
    const t = node('r', undefined, { body: [node('a'), node('b')] })
    expect(canExecute(t).ok).toBe(true)
  })

  it('★ 有語法錯誤 → 不可以跑，而且說得出是哪些節點', () => {
    const t = node('r', undefined, { body: [node('a'), node('bad', 'syntax_error')] })
    const r = canExecute(t)
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.nodeIds, '擋住了卻說不出是哪裡').toEqual(['bad'])
  })

  it('🔴 ★ `unsupported` → **可以跑**（那是我們的問題，不是使用者的）', () => {
    const t = node('r', undefined, { body: [node('u', 'unsupported')] })
    expect(
      canExecute(t).ok,
      '把「我們還沒長到」擋成使用者的錯 → 學生的合法程式跑不動，而原因是我們的極限',
    ).toBe(true)
  })

  it('🔴 ★ `nonstandard_but_valid` → **可以跑**', () => {
    const t = node('r', undefined, { body: [node('n', 'nonstandard_but_valid')] })
    expect(canExecute(t).ok).toBe(true)
  })

  it('★ 巢狀深處的語法錯誤也擋得住', () => {
    const t = node('r', undefined, { body: [node('f', undefined, { body: [node('deep', 'syntax_error')] })] })
    const r = canExecute(t)
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.nodeIds).toEqual(['deep'])
  })

  it('★ 多處語法錯誤 → 全部列出來，不是只報第一個', () => {
    const t = node('r', undefined, { body: [node('a', 'syntax_error'), node('b', 'syntax_error')] })
    const r = canExecute(t)
    expect(r.ok === false && r.nodeIds).toEqual(['a', 'b'])
  })

  it('★ 混合：語法錯誤 ＋ 我們不認得的 → 擋，而只指名語法錯誤那個', () => {
    const t = node('r', undefined, { body: [node('u', 'unsupported'), node('s', 'syntax_error')] })
    const r = canExecute(t)
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.nodeIds, '把不相干的節點也指名了 → 訊息會指錯地方').toEqual(['s'])
  })

  it('★ 純函式：跑兩次相同，而且不改樹', () => {
    const t = node('r', undefined, { body: [node('s', 'syntax_error')] })
    const before = JSON.stringify(t)
    expect(canExecute(t)).toEqual(canExecute(t))
    expect(JSON.stringify(t)).toBe(before)
  })
})
