/** `python:delete` 的 **generate** 路——`del a, o.x`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:delete', (node, ctx) => {
    const targets = (node.slots.targets ?? []).map((t) => generateExpression(t, ctx))
    return `${indent(ctx)}del ${targets.join(', ')}\n`
  })
}
