/** `python:throw` 的 **generate** 路——`raise ValueError("…")`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:throw', (node, ctx) => {
    const name = String(node.properties.exception ?? 'ValueError')
    const v = (node.children.value ?? [])[0]
    // ⚠️ 沒有訊息時**不能產出一對空括號**——`raise X()` 與 `raise X` 在 Python
    //    是同一件事，而來回轉換要一字不差。
    return `${indent(ctx)}raise ${name}${v ? `(${generateExpression(v, ctx)})` : ''}\n`
  })
}
