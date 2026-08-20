/** `python:loop_for` 的 **generate** 路——for-each，縮排不是大括號。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, indented, generateExpression, generateBody } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:loop_for', (node, ctx) => {
    const name = String(node.properties.obj ?? 'i')
    const it = generateExpression((node.children.iterable ?? [])[0], ctx)
    const body = node.children.body ?? []
    const inner = indented(ctx)
    const bodyCode = body.length > 0 ? generateBody(body, inner) : `${indent(inner)}pass\n`
    return `${indent(ctx)}for ${name} in ${it}:\n${bodyCode}`
  })
}
