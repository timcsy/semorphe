/** `cpp:serial_read_string` 的 **generate** 路（435）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:serial_read_string', (node, ctx) => {
    const c = (node.slots.until ?? [])[0]
    return `${String(node.properties.obj ?? 'Serial')}.readStringUntil(${c ? generateExpression(c, ctx) : ''})`
  })
}
