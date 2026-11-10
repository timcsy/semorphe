/** `python:string_format` 的 **generate** 路——`"{}".format(a, b)`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'
import { genReceiver } from '../../../core/projection/precedence'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:string_format', (node, ctx) => {
    const o = genReceiver((node.slots.obj ?? [])[0], ctx)
    const args = (node.slots.args ?? []).map((a) => generateExpression(a, ctx))
    return `${o}.format(${args.join(', ')})`
  })
}
