/** `cpp:touch_read` 的 **generate** 路。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:touch_read', (node, ctx) => {
    const pin = generateExpression((node.children.pin ?? [])[0], ctx)
    return `touchRead(${pin})`
  })
}
