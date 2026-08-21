/** `python:container_sort` 的 **generate** 路——`sorted(…)`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:container_sort', (node, ctx) =>
    `sorted(${(node.children.obj ?? []).map((v) => generateExpression(v, ctx)).join(', ')})`)
}
