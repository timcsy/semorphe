/** `cpp:pwm_write` 的 **generate** 路。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:pwm_write', (node, ctx) => {
    const target = generateExpression((node.children.target ?? [])[0], ctx)
    const duty = generateExpression((node.children.duty ?? [])[0], ctx)
    return `${indent(ctx)}ledcWrite(${target}, ${duty});\n`
  })
}
