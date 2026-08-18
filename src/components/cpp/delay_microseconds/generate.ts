/** `cpp:delay_microseconds` 的 **generate** 路。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:delay_microseconds', (node, ctx) => {
    const us = generateExpression((node.children.us ?? [])[0], ctx)
    return `${indent(ctx)}delayMicroseconds(${us});\n`
  })
}
