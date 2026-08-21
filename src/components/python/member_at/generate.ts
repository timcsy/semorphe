/** `python:member_at` 的 **generate** 路——`math.pi`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:member_at', (node, ctx) => {
    const obj = (node.children.obj ?? [])[0]
    return `${obj ? generateExpression(obj, ctx) : ''}.${node.properties.member ?? ''}`
  })
}
