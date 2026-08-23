/** `python:container_all` 的 **generate** 路——`all(…)`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:container_all', (node, ctx) => {
    const parts = ["obj"]
      .map((k) => (node.children as Record<string, unknown[]>)[k]?.[0])
      .filter(Boolean)
      .map((n) => generateExpression(n as never, ctx))
    return `all(${parts.join(', ')})`
  })
}
