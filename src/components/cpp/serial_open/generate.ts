/** `cpp:serial_open` 的 **generate** 路。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:serial_open', (node, ctx) => {
    const obj = String(node.properties.obj ?? 'Serial')
    const baud = generateExpression((node.children.baud ?? [])[0], ctx)
    return `${indent(ctx)}${obj}.begin(${baud});\n`
  })
}
