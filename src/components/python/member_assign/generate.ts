/** `python:member_assign` 的 **generate** 路——`左邊 = 值`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:member_assign', (node, ctx) => {
    const t = generateExpression((node.children.target ?? [])[0], ctx)
    const v = generateExpression((node.children.value ?? [])[0], ctx)
    return `${indent(ctx)}${t} = ${v}\n`
  })
}
