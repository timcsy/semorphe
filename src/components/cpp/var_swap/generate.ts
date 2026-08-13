/** `cpp:var_swap` 的 **generate** 路 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:var_swap', (node, ctx) => {
    const left = (node.children.left ?? [])[0]
    const right = (node.children.right ?? [])[0]
    const a = left ? generateExpression(left, ctx) : 'a'
    const b = right ? generateExpression(right, ctx) : 'b'
    return `${indent(ctx)}swap(${a}, ${b});\n`
  })
}
