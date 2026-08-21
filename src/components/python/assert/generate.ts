/** `python:assert` 的 **generate** 路——`assert x > 0, "訊息"`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:assert', (node, ctx) => {
    const cond = generateExpression((node.children.condition ?? [])[0], ctx)
    const msg = (node.children.value ?? [])[0]
    // ⚠️ 沒有訊息時**不能產出一個逗號**
    return `${indent(ctx)}assert ${cond}${msg ? `, ${generateExpression(msg, ctx)}` : ''}\n`
  })
}
