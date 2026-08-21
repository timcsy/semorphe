/** `python:cast` 的 **generate** 路——`int(…)`／`str(…)`／`float(…)`／`bool(…)`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:cast', (node, ctx) => {
    const to = String(node.properties.target_type ?? 'int')
    const v = (node.children.value ?? [])[0]
    return `${to}(${v ? generateExpression(v, ctx) : ''})`
  })
}
