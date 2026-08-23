/** `python:math_divmod` 的 **generate** 路——`divmod(…)`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:math_divmod', (node, ctx) => {
    const parts = ["obj", "value"]
      .map((k) => (node.children as Record<string, unknown[]>)[k]?.[0])
      .filter(Boolean)
      .map((n) => generateExpression(n as never, ctx))
    return `divmod(${parts.join(', ')})`
  })
}
