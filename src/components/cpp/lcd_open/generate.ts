/** `cpp:lcd_open` 的 **generate** 路。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:lcd_open', (node, ctx) => {
    const obj = String(node.properties.obj ?? 'lcd')
    const cols = generateExpression((node.children.cols ?? [])[0], ctx)
    const rows = generateExpression((node.children.rows ?? [])[0], ctx)
    return `${indent(ctx)}${obj}.begin(${cols}, ${rows});\n`
  })
}
