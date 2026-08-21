/** `python:math_max` 的 **generate** 路——`max(…)`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:math_max', (node, ctx) =>
    `max(${(node.children.values ?? []).map((v) => generateExpression(v, ctx)).join(', ')})`)
}
