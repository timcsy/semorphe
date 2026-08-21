/** `python:map_iter` 的 **generate** 路。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:map_iter', (node, ctx) => {
    const o = generateExpression((node.children.obj ?? [])[0], ctx)
    return `${o}.${String(node.properties.kind ?? 'items')}()`
  })
}
