/** `python:container_insert` 的 **generate** 路——`x.insert(…)`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression, indent } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:container_insert', (node, ctx) => {
    const o = generateExpression((node.children.obj ?? [])[0], ctx)
    const parts = ["index", "value"]
      .map((k) => (node.children as Record<string, unknown[]>)[k]?.[0])
      .filter(Boolean)
      .map((n) => generateExpression(n as never, ctx))
    return `${indent(ctx)}${o}.insert(${parts.join(', ')})\n`
  })
}
