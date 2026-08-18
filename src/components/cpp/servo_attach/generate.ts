/** `cpp:servo_attach` 的 **generate** 路。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:servo_attach', (node, ctx) => {
    const obj = String(node.properties.obj ?? 'myServo')
    const pin = generateExpression((node.children.pin ?? [])[0], ctx)
    return `${indent(ctx)}${obj}.attach(${pin});\n`
  })
}
