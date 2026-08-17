/** `cpp:digital_read` 的 **generate** 路——它是運算式，不加縮排也不加分號。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:digital_read', (node, ctx) => {
    const pin = generateExpression((node.children.pin ?? [])[0], ctx)
    return `digitalRead(${pin})`
  })
}
