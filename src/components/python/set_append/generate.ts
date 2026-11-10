/** `python:set_append` 的 **generate** 路——`x.add(…)`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression, indent } from '../../../core/projection/code-generator'
import { genReceiver } from '../../../core/projection/precedence'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:set_append', (node, ctx) => {
    const o = genReceiver((node.slots.obj ?? [])[0], ctx)
    const parts = ["value"]
      .map((k) => (node.slots as Record<string, unknown[]>)[k]?.[0])
      .filter(Boolean)
      .map((n) => generateExpression(n as never, ctx))
    return `${indent(ctx)}${o}.add(${parts.join(', ')})\n`
  })
}
