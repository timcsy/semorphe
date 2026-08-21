/** `python:map_at_default` 的 **generate** 路。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:map_at_default', (node, ctx) => {
    const o = generateExpression((node.children.obj ?? [])[0], ctx)
    // ⚠️ **可有可無的那一格空著時不能產出一個逗號**——`d.get(k, )` 不是合法的 Python
    const a = ["key", "fallback"]
      .map((k) => (node.children as Record<string, unknown[]>)[k]?.[0])
      .filter(Boolean)
      .map((n) => generateExpression(n as never, ctx))
    return `${o}.get(${a.join(', ')})`
  })
}
