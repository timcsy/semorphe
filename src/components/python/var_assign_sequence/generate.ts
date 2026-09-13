/** `python:var_assign_sequence` 的 **generate** 路——`x, y = p`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:var_assign_sequence', (node, ctx) => {
    const names = (node.slots.targets ?? []).map((t) => String(t.properties.name ?? '')).join(', ')
    const v = (node.slots.value ?? [])[0]
    return `${indent(ctx)}${names} = ${v ? generateExpression(v, ctx) : 'None'}\n`
  })
}
