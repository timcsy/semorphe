/** `python:container_filter` 的 **generate** 路——`filter(…)`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:container_filter', (node, ctx) => {
    const parts = ["func", "obj"]
      .map((k) => (node.children as Record<string, unknown[]>)[k]?.[0])
      .filter(Boolean)
      .map((n) => generateExpression(n as never, ctx))
    return `filter(${parts.join(', ')})`
  })
}
