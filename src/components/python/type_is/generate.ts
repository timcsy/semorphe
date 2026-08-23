/** `python:type_is` 的 **generate** 路——`isinstance(x, int)`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:type_is', (node, ctx) => {
    const o = generateExpression((node.children.obj ?? [])[0], ctx)
    return `isinstance(${o}, ${node.properties.target_type ?? 'int'})`
  })
}
