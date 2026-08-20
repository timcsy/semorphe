/** `python:return` 的 **generate** 路——沒有值時就只有 `return`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:return', (node, ctx) => {
    const kid = (node.children.value ?? [])[0]
    // `return` 與 `return None` 在 Python 是同一件事，而**原文是哪一個要記得**
    // —— 沒有子節點就產裸的 `return`，不要自作主張補一個 `None`。
    return kid ? `${indent(ctx)}return ${generateExpression(kid, ctx)}\n` : `${indent(ctx)}return\n`
  })
}
