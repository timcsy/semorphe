/** `cpp:delay` 的 **generate** 路。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:delay', (node, ctx) => {
    const ms = generateExpression((node.children.ms ?? [])[0], ctx)
    return `${indent(ctx)}delay(${ms});\n`
  })
}
