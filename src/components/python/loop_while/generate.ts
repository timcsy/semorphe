/**
 * `python:loop_while` 的 **generate** 路。
 *
 * ⚠️ **Python 用縮排不用大括號**——所以這裡沒有 `openBraceFor`，
 * 而 `indented(ctx)` 就是全部。**空的 body 要產 `pass`**：
 * 一個沒有內容的 `while` 在 Python 是語法錯誤。
 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, indented, generateExpression, generateBody, trackOwnText} from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:loop_while', (node, ctx) => {
    const cond = generateExpression((node.children.condition ?? [])[0], ctx)
    const body = node.children.body ?? []
    const inner = indented(ctx)
    // 🔴 **標頭那一行要先算進行號**（2026-08-24）——否則主體裡每一顆的
    //    對應都往上偏一行，使用者按下積木時**反白到上一行**。
    //    見 `core/projection/code-generator.ts` 的 `trackOwnText`。
    const head = `${indent(ctx)}while ${cond}:\n`
    trackOwnText(ctx, head)
    const bodyCode = body.length > 0 ? generateBody(body, inner) : `${indent(inner)}pass\n`
    return head + bodyCode
  })
}
