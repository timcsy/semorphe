/** `python:range_make` 的 **generate** 路——`range(…)`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:range_make', (node, ctx) =>
    `range(${(node.children.values ?? []).map((v) => generateExpression(v, ctx)).join(', ')})`)
}
