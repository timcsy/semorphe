/** `python:splat` 的 **generate** 路——`*nums` / `**d`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:splat', (node, ctx) => {
    const inner = (node.children.value ?? [])[0]
    const star = node.properties.kind === 'dict' ? '**' : '*'
    return `${star}${inner ? generateExpression(inner, ctx) : ''}`
  })
}
