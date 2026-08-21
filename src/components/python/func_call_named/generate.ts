/** `python:func_call_named` 的 **generate** 路——`key=f`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:func_call_named', (node, ctx) => {
    const v = (node.children.value ?? [])[0]
    return `${node.properties.name ?? ''}=${v ? generateExpression(v, ctx) : 'None'}`
  })
}
