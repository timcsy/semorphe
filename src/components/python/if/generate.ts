/**
 * `python:if` 的 **generate** 路——`if` / `elif…` / `else`。
 *
 * ⚠️ **縮排不是大括號**，而空的分支要產 `pass`：
 * 一個沒有內容的 `if` 在 Python 是語法錯誤。
 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, indented, generateExpression, generateBody, trackOwnText} from '../../../core/projection/code-generator'
import type { SemanticNode } from '../../../core/types'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:if', (node, ctx) => {
    // ⚠️ **每個分支重算一次 `indented(ctx)`**——`generateBody` 會在傳進去的 ctx
    // 上記帳，共用一份的話第二個分支拿到的縮排已經被動過。
    const section = (kids: SemanticNode[] | undefined): string => {
      const inner = indented(ctx)
      return (kids ?? []).length > 0 ? generateBody(kids ?? [], inner) : `${indent(inner)}pass\n`
    }
    /** 一支分支的主體——`_compound` 是「一段」，其餘是單獨一行。 */
    const branchBody = (n: SemanticNode | undefined): SemanticNode[] =>
      !n ? [] : n.componentId === '_compound' ? (n.children.body ?? []) : [n]

    const cond = generateExpression((node.children.condition ?? [])[0], ctx)
    // 🔴 **每一段標頭都要先算進行號**（2026-08-24）——否則那一段主體裡每一顆的
    //    對應都往上偏一行，使用者按下積木時**反白到上一行**。
    const ifHead = `${indent(ctx)}if ${cond}:\n`
    trackOwnText(ctx, ifHead)
    let out = ifHead + section(node.children.body)

    const elifConds = node.children.elif_condition ?? []
    const elifBodies = node.children.elif_body ?? []
    for (let i = 0; i < elifConds.length; i++) {
      const elifHead = `${indent(ctx)}elif ${generateExpression(elifConds[i], ctx)}:\n`
      trackOwnText(ctx, elifHead)
      out += elifHead
      // 🔴 兩個清單靠索引配對——少一格的話這裡會拿到 undefined，而 `section` 產 `pass`。
      //    那正是「錯開之後每一格都還在，只是接錯了人」看起來的樣子。
      // ⚠️ **一支的主體可以是「一段」**（`_compound`）——攤回去才印得出第二行起
      out += section(branchBody(elifBodies[i]))
    }
    if ((node.children.else_body ?? []).length > 0) {
      const elseHead = `${indent(ctx)}else:\n`
      trackOwnText(ctx, elseHead)
      out += elseHead + section(node.children.else_body)
    }
    return out
  })
}
