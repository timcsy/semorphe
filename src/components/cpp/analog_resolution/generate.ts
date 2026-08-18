/** `cpp:analog_resolution` 的 **generate** 路。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:analog_resolution', (node, ctx) => {
    const bits = generateExpression((node.children.bits ?? [])[0], ctx)
    return `${indent(ctx)}analogReadResolution(${bits});\n`
  })
}
