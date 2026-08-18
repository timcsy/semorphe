/** `cpp:lcd_clear` 的 **generate** 路。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:lcd_clear', (node, ctx) => {
    const obj = String(node.properties.obj ?? 'lcd')
    return `${indent(ctx)}${obj}.clear();\n`
  })
}
