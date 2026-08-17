/** `cpp:pin_mode` 的 **generate** 路。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:pin_mode', (node, ctx) => {
    const pin = generateExpression((node.children.pin ?? [])[0], ctx)
    const mode = generateExpression((node.children.mode ?? [])[0], ctx)
    return `${indent(ctx)}pinMode(${pin}, ${mode});\n`
  })
}
