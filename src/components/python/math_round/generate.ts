/** `python:math_round` 的 **generate** 路。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:math_round', (node, ctx) => {
    // ⚠️ **可有可無的那一格空著時不能產出一個逗號**——`round(x, )` 不是合法的 Python
    const a = ["value", "digits"]
      .map((k) => (node.children as Record<string, unknown[]>)[k]?.[0])
      .filter(Boolean)
      .map((n) => generateExpression(n as never, ctx))
    return `round(${a.join(', ')})`
  })
}
