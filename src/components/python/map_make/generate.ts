/** `python:map_make` 的 **generate** 路——`{鍵: 值, 鍵: 值}`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:map_make', (node, ctx) =>
    `{${(node.children.pairs ?? []).map((p) => generateExpression(p, ctx)).join(', ')}}`)
}
