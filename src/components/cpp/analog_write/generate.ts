/** `cpp:analog_write` 的 **generate** 路。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:analog_write', (node, ctx) => {
    const pin = generateExpression((node.children.pin ?? [])[0], ctx)
    const value = generateExpression((node.children.value ?? [])[0], ctx)
    return `${indent(ctx)}analogWrite(${pin}, ${value});\n`
  })
}
