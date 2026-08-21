/** `python:var_assign_compound` 的 **generate** 路——`total += i`（**沒有分號**）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:var_assign_compound', (node, ctx) => {
    const name = node.properties.name ?? 'x'
    const op = node.properties.operator ?? '+='
    const vals = node.children.value ?? []
    const val = vals.length > 0 ? generateExpression(vals[0], ctx) : '0'
    return `${indent(ctx)}${name} ${op} ${val}\n`
  })
}
