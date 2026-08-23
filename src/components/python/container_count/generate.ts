/** `python:container_count` 的 **generate** 路——`x.count(…)`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:container_count', (node, ctx) => {
    const o = generateExpression((node.children.obj ?? [])[0], ctx)
    const parts = ["value"]
      .map((k) => (node.children as Record<string, unknown[]>)[k]?.[0])
      .filter(Boolean)
      .map((n) => generateExpression(n as never, ctx))
    return `${o}.count(${parts.join(', ')})`
  })
}
