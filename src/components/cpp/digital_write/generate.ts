/** `cpp:digital_write` 的 **generate** 路。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:digital_write', (node, ctx) => {
    const pin = generateExpression((node.slots.pin ?? [])[0], ctx)
    const value = generateExpression((node.slots.value ?? [])[0], ctx)
    return `${indent(ctx)}digitalWrite(${pin}, ${value});\n`
  })
}
