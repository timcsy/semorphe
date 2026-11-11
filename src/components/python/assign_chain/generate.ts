/** `python:assign_chain` 的 **generate** 路——`a = b = 0`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:assign_chain', (node, ctx) => {
    const targets = (node.slots.targets ?? []).map((t) => generateExpression(t, ctx))
    const v = (node.slots.value ?? [])[0]
    return `${indent(ctx)}${[...targets, v ? generateExpression(v, ctx) : 'None'].join(' = ')}\n`
  })
}
