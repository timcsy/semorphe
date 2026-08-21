/** `python:array_make` 的 **generate** 路——`[1, 2, 3]`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:array_make', (node, ctx) =>
    `[${(node.children.items ?? []).map((v) => generateExpression(v, ctx)).join(', ')}]`)
}
