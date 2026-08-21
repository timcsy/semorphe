/** `python:lambda` 的 **generate** 路——`lambda p: p[1]`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:lambda', (node, ctx) => {
    const names = (node.children.params ?? []).map((p) => String(p.properties.name ?? '')).join(', ')
    const body = (node.children.body ?? [])[0]
    return `lambda${names ? ` ${names}` : ''}: ${body ? generateExpression(body, ctx) : 'None'}`
  })
}
