/**
 * `python:if` 的 **lift** 路——把 `elif` 鏈攤平。
 *
 * ## 為什麼是具名策略
 *
 * tree-sitter-python 把 `elif` 切成掛在 `alternative` 上的一條**遞迴的
 * `elif_clause` 鏈**（不是像 C 那樣巢狀的 `if`），而 `fieldMappings`
 * 只認得住「一個欄位對一個接點」。要把那條鏈攤平成兩個並排的清單，
 * 得走一段真的邏輯。
 *
 * ⚠️ spec 168 把帶 `elif` 的 if **整顆降級**，而那是刻意的邊界
 * （少做一半而不出聲比降級更貴）。spec 169 把那個邊界收掉了。
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'
import { commentSyntax } from '../../../core/comment-syntax'

/** 剝掉註解符號——規則住在語言套件，這裡只借用。 */
const stripComment = (raw: string): string => commentSyntax().strip(raw)

/* eslint-disable @typescript-eslint/no-explicit-any */

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:liftIf', (node, ctx) => {
    /** 把一個 `block` 攤成語句列。`_compound` 是核心用來表示「一段」的結構身分。 */
    const body = (n: any): SemanticNode[] => {
      if (!n) return []
      const lifted = ctx.lift(n)
      if (!lifted) return []
      return lifted.componentId === '_compound' ? (lifted.children.body ?? []) : [lifted]
    }

    const condition = ctx.lift(node.childForFieldName('condition') as never)
    // 條件認不出來就整顆降級——一個沒有條件的 if 產不回合法的程式碼。
    if (!condition) return null

    const elifConds: SemanticNode[] = []
    const elifBodies: SemanticNode[][] = []
    let elseBody: SemanticNode[] = []
    // 🔴 **`elif …:  # 為什麼` 的註解掛在【子句】上**（2026-08-23）：
    //    核心那條「與這個語句同一列的子註解」規則只看得到 `if` 那一行
    //    ——`elif`／`else` 的在子句裡，而**只有這裡知道那是第幾支**。
    const clauseNotes: { text: string; slot: string }[] = []
    const noteOf = (clause: any, slot: string): void => {
      for (const kid of clause.namedChildren as any[]) {
        if (kid.type !== 'comment' || kid.startPosition.row !== clause.startPosition.row) continue
        clauseNotes.push({ text: stripComment(kid.text), slot })
      }
    }

    // 🔴 **`elif_clause` 與 `else_clause` 是 `if_statement` 的【兄弟】，不是遞迴巢狀的。**
    //
    // ⚠️ 第一版順著 `alternative` 一路往下走（以為它像 C 那樣巢狀），
    // 於是只拿得到第一個 elif，而 else 永遠拿不到——**而它不會報錯**：
    // 產出來的是一個「少了兩個分支」的 if，看起來完全正常。
    //
    // 實測的形狀（`tree-sitter-python`）：
    // ```
    // if_statement [identifier, block, elif_clause, elif_clause, else_clause]
    // ```
    // > **一個結構猜錯了，症狀不是崩潰，是【安靜地少做】。**
    for (const kid of node.namedChildren as any[]) {
      if (kid.type === 'elif_clause') {
        const c = ctx.lift(kid.childForFieldName('condition'))
        // ⚠️ **一個 elif 的條件認不出來 → 整顆降級**，不要只丟掉那一支。
        // 丟掉一支的話產回去的程式碼**少了一個分支**，而它看起來完全正常。
        if (!c) return null
        noteOf(kid, `elif:${elifConds.length}`)
        elifConds.push(c)
        elifBodies.push(body(kid.childForFieldName('consequence')))
      } else if (kid.type === 'else_clause') {
        noteOf(kid, 'else')
        elseBody = body(kid.childForFieldName('body'))
      }
    }

    const children: Record<string, SemanticNode[]> = {
      condition: [condition],
      body: body(node.childForFieldName('consequence')),
    }
    // ⚠️ **空的接點不要寫進去**——`extraStateFlags` 用「這個接點是不是空的」
    // 決定 `hasElse`，而一個空陣列與沒有這個鍵在那裡是同一件事，
    // 但寫進去會讓語義樹多出一堆空鍵。
    if (elifConds.length > 0) {
      children.elif_condition = elifConds
      // 🔴 **兩個清單長度必須相同**——它們靠索引配對。
      // ⚠️ 一支空的 elif（`elif c: pass`）在這裡是一格空陣列，
      //    而**塞一顆填充節點會讓「空的分支」與「掉了的分支」長得一樣**。
      //    → 有任何一支是空的就整顆降級，讓原文原樣留著。
      if (elifBodies.some((b) => b.length === 0)) return null
      // 🔴 **一支 elif 的主體可以有很多行**（2026-08-23 修）：原本只留 `b[0]`，
      //    於是 `elif r == 0:` 底下第二行起**整段安靜地不見**
      //    ——不報錯、積木畫得出來、產回去是一段合法的 Python，而少了幾行。
      //    🟢 多行包成 `_compound`（核心表示「一段」的結構身分），一行的照原樣。
      children.elif_body = elifBodies.map((b) => (b.length === 1 ? b[0] : createNode('_compound', {}, { body: b })))
    }
    if (elseBody.length > 0) children.else_body = elseBody

    const made = createNode('python:if', {}, children)
    if (clauseNotes.length > 0) {
      made.annotations = [
        ...(made.annotations ?? []),
        ...clauseNotes.map((n) => ({ type: 'comment' as const, text: n.text, position: 'inline' as const, slot: n.slot })),
      ]
    }
    return made
  })
}
