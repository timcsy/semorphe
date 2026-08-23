/** `python:string_compare_suffix` 的 **generate** 路——`x.endswith(…)`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:string_compare_suffix', (node, ctx) => {
    const o = generateExpression((node.children.obj ?? [])[0], ctx)
    const parts = ["value"]
      .map((k) => (node.children as Record<string, unknown[]>)[k]?.[0])
      .filter(Boolean)
      .map((n) => generateExpression(n as never, ctx))
    return `${o}.endswith(${parts.join(', ')})`
  })
}
