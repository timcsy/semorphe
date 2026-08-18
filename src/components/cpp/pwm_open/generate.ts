/** `cpp:pwm_open` 的 **generate** 路。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:pwm_open', (node, ctx) => {
    const channel = generateExpression((node.children.channel ?? [])[0], ctx)
    const freq = generateExpression((node.children.freq ?? [])[0], ctx)
    const bits = generateExpression((node.children.bits ?? [])[0], ctx)
    return `${indent(ctx)}ledcSetup(${channel}, ${freq}, ${bits});\n`
  })
}
