/** `cpp:pwm_tie` 的 **generate** 路。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:pwm_tie', (node, ctx) => {
    const pin = generateExpression((node.slots.pin ?? [])[0], ctx)
    const channel = generateExpression((node.slots.channel ?? [])[0], ctx)
    return `${indent(ctx)}ledcAttachPin(${pin}, ${channel});\n`
  })
}
