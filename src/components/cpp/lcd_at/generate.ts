/** `cpp:lcd_at` 的 **generate** 路。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:lcd_at', (node, ctx) => {
    const obj = String(node.properties.obj ?? 'lcd')
    const col = generateExpression((node.children.col ?? [])[0], ctx)
    const row = generateExpression((node.children.row ?? [])[0], ctx)
    return `${indent(ctx)}${obj}.setCursor(${col}, ${row});\n`
  })
}
