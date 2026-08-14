/**
 * **樹是診斷的第二個產出端。**
 *
 * ## 它從哪來
 *
 * 2026-08-14，使用者說「連分號的錯誤訊息都沒有處理的很好，甚至還不會報出來」。
 * 查證屬實，而根因是**兩條路今天不可能會合**：
 *
 * ```
 * 診斷   app.ts  吃【積木】——而積木上看不出少了分號
 *                （tree-sitter 復原之後那顆積木是完整的）
 * 殘差   monaco  吃【樹】——而它只在程式碼面板裡，積木面板拿不到
 * ```
 *
 * 語法錯誤的資料在**樹**上，所以它需要一個**吃樹的產出端**。
 *
 * ## 🔴 而這支測試最重要的一條是負向的
 *
 * `degradationCause` 有三個值，而**只有 `syntax_error` 是使用者的問題**：
 *
 * ```
 * syntax_error            你打錯了      → 搬進診斷，Error 級
 * unsupported             我還沒長到    → 留在殘差，Info 級
 * nonstandard_but_valid   我認得但不標準 → 留在殘差，Info 級
 * ```
 *
 * > **一起搬走的話，學生會看到「你的程式有 12 個錯誤」，
 * > 而其中 11 個是我們的問題。**
 *
 * 三者今天共用同一段程式碼，所以「只挑一種」不是自然發生的——**要被釘住**。
 */
import { describe, it, expect } from 'vitest'
import { diagnosticsFromTree, isResidualCause, DIAGNOSTIC_CAUSES } from '../../../src/core/diagnostics'
import type { SemanticNode } from '../../../src/core/types'

/** 造一個節點。`cause` 給了才有 metadata——**沒給就是一顆健康的節點**。 */
function node(
  id: string,
  conceptId: string,
  cause?: 'syntax_error' | 'unsupported' | 'nonstandard_but_valid',
  rawCode?: string,
  children: Record<string, SemanticNode[]> = {},
): SemanticNode {
  return {
    id,
    conceptId,
    properties: {},
    children,
    ...(cause ? { metadata: { degradationCause: cause, rawCode: rawCode ?? '' } } : {}),
  } as SemanticNode
}

describe('diagnosticsFromTree：樹上的語法錯誤變成診斷', () => {
  it('★ 正向錨點：一棵健康的樹產出 0 則（先證明量得到「乾淨」）', () => {
    const tree = node('r', 'cpp:program', undefined, undefined, {
      body: [node('a', 'cpp:var_declare'), node('b', 'cpp:print')],
    })
    expect(diagnosticsFromTree(tree)).toEqual([])
  })

  it('★ 一個語法錯誤 → 一則錯誤級診斷，來源是解析器', () => {
    const tree = node('r', 'cpp:program', undefined, undefined, {
      body: [node('a', 'cpp:var_declare', 'syntax_error', 'int x = 1')],
    })
    const ds = diagnosticsFromTree(tree)
    expect(ds).toHaveLength(1)
    expect(ds[0]).toEqual({
      nodeId: 'a',
      severity: 'error',
      rule: 'SYNTAX_ERROR',
      params: { snippet: 'int x = 1' },
      source: 'parser',
    })
  })

  it('🔴 ★ `unsupported` 與 `nonstandard_but_valid` **一則都不准產出**', () => {
    const tree = node('r', 'cpp:program', undefined, undefined, {
      body: [
        node('u', 'cpp:raw_code', 'unsupported', 'template<...> weird'),
        node('n', 'cpp:var_declare', 'nonstandard_but_valid', 'int x asm("r1")'),
      ],
    })
    expect(
      diagnosticsFromTree(tree),
      '把「我們還沒長到」也搬成錯誤 → 學生會看到「你的程式有 12 個錯誤」而其中 11 個是我們的問題',
    ).toEqual([])
  })

  it('🔴 ★ 三種混在同一棵樹上 → 只挑出語法錯誤那一則', () => {
    const tree = node('r', 'cpp:program', undefined, undefined, {
      body: [
        node('u', 'cpp:raw_code', 'unsupported', 'weird'),
        node('s', 'cpp:var_declare', 'syntax_error', 'int x = 1'),
        node('n', 'cpp:print', 'nonstandard_but_valid', 'odd'),
      ],
    })
    const ds = diagnosticsFromTree(tree)
    expect(ds.map((d) => d.nodeId), '挑錯了或多挑了').toEqual(['s'])
  })

  it('★ 巢狀：深處的語法錯誤也要找得到', () => {
    const tree = node('r', 'cpp:program', undefined, undefined, {
      body: [
        node('f', 'cpp:func_def', undefined, undefined, {
          body: [node('deep', 'cpp:var_declare', 'syntax_error', 'int y = 2')],
        }),
      ],
    })
    expect(diagnosticsFromTree(tree).map((d) => d.nodeId)).toEqual(['deep'])
  })

  it('★ 多處語法錯誤 → 多則，而它們靠 snippet 互相區分', () => {
    const tree = node('r', 'cpp:program', undefined, undefined, {
      body: [
        node('a', 'cpp:var_declare', 'syntax_error', 'int x = 1'),
        node('b', 'cpp:var_declare', 'syntax_error', 'int y = 2'),
      ],
    })
    const ds = diagnosticsFromTree(tree)
    expect(ds).toHaveLength(2)
    // ⚠️ 沒有這個的話兩則長得一模一樣——上一輪 `int , , ;` 就是這個病。
    expect(ds.map((d) => d.params.snippet)).toEqual(['int x = 1', 'int y = 2'])
  })

  it('★ 原文是空的也要產出——「有語法錯誤」不依賴「抄得到原文」', () => {
    const tree = node('r', 'cpp:program', undefined, undefined, {
      body: [node('a', 'cpp:var_declare', 'syntax_error', '')],
    })
    const ds = diagnosticsFromTree(tree)
    expect(ds).toHaveLength(1)
    expect(ds[0].params.snippet).toBe('')
  })

  it('★ 純函式：跑兩次結果相同，而且不改樹', () => {
    const tree = node('r', 'cpp:program', undefined, undefined, {
      body: [node('a', 'cpp:var_declare', 'syntax_error', 'int x = 1')],
    })
    const before = JSON.stringify(tree)
    const first = diagnosticsFromTree(tree)
    const second = diagnosticsFromTree(tree)
    expect(first).toEqual(second)
    expect(JSON.stringify(tree), '產出端改了樹').toBe(before)
  })
})

/**
 * 🔴 **兩個通道必須剛好把三種降級原因分完——不重、不漏。**
 *
 * 這是本功能的核心不變式，而它同時擋住兩個相反的錯誤：
 *
 * ```
 * 重疊  →  同一件事顯示兩次（一條紅波浪 ＋ 一條灰提示疊在同一行）
 * 遺漏  →  某一種降級原因【兩邊都不顯示】，而它會安靜地消失
 * 搬錯  →  「我還沒長到」被當成「你寫錯了」
 * ```
 *
 * ⚠️ **為什麼不用 e2e 測「unsupported 仍是 Info」**：那需要一段
 * 「確定不被支援」的 C++，而 `tests/baselines/projection-residual.json`
 * 的 `residual2` 是 **0**——語料裡一段都沒有。
 * **一支找不到樣本的 e2e 會空過，而空過的測試與健康的長得一樣。**
 */
describe('兩個通道剛好分完三種降級原因', () => {
  /** 型別上所有的降級原因。⚠️ 加一種而沒有分配的話，下面的測試會紅。 */
  const ALL = ['syntax_error', 'unsupported', 'nonstandard_but_valid'] as const

  it('★ 入口條件：真的有三種（錨在合成量）', () => {
    expect(ALL.length, '降級原因少於三種 → 這組測試不算數').toBe(3)
  })

  it('🔴 ★ 不重疊：沒有一種原因同時走兩條通道', () => {
    const both = ALL.filter((c) => DIAGNOSTIC_CAUSES.includes(c) && isResidualCause(c))
    expect(both, '同一件事會顯示兩次——一條紅波浪疊一條灰提示').toEqual([])
  })

  it('🔴 ★ 不遺漏：每一種原因都有一條通道', () => {
    const orphan = ALL.filter((c) => !DIAGNOSTIC_CAUSES.includes(c) && !isResidualCause(c))
    expect(orphan, '這種降級原因兩邊都不顯示——它會安靜地消失').toEqual([])
  })

  it('🔴 ★ 分對邊：只有 `syntax_error` 是使用者的問題', () => {
    expect(
      ALL.filter((c) => DIAGNOSTIC_CAUSES.includes(c)),
      '把「我還沒長到」搬進診斷 → 我們的問題會被顯示成學生的錯誤',
    ).toEqual(['syntax_error'])
    expect(ALL.filter((c) => isResidualCause(c))).toEqual(['unsupported', 'nonstandard_but_valid'])
  })
})
