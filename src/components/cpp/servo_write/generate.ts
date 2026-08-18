/** `cpp:servo_write` 的 **generate** 路。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:servo_write', (node, ctx) => {
    const obj = String(node.properties.obj ?? 'myServo')
    const angle = generateExpression((node.children.angle ?? [])[0], ctx)
    return `${indent(ctx)}${obj}.write(${angle});\n`
  })
}
