/** `python:decorated` 的 **generate** 路——一行一個 `@裝飾器`，接著是定義。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression, generateBody, trackOwnText } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:decorated', (node, ctx) => {
    const head = (node.slots.decorators ?? []).map((d) => `${indent(ctx)}@${generateExpression(d, ctx)}\n`).join('')
    // 🔴 裝飾器那幾行要先算進行號——否則定義裡每一顆的對應都往上偏（同類別定義的標頭）
    trackOwnText(ctx, head)
    return head + generateBody(node.slots.definition ?? [], ctx)
  })
}
