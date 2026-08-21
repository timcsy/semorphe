/** `python:container_size` 的 **generate** 路——`len(…)`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:container_size', (node, ctx) =>
    `len(${(node.children.obj ?? []).map((v) => generateExpression(v, ctx)).join(', ')})`)
}
