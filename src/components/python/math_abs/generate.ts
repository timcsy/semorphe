/** `python:math_abs` 的 **generate** 路——`abs(…)`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:math_abs', (node, ctx) =>
    `abs(${(node.children.value ?? []).map((v) => generateExpression(v, ctx)).join(', ')})`)
}
