/** `cpp:range_remove` 的 **generate** 路 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'
import { rangeEndsCode } from '../../../languages/cpp/lang/runtime/range-lift'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:range_remove', (node, ctx) => {
    const [begin, end] = rangeEndsCode(node, ctx, generateExpression)
    return `remove(${begin}, ${end}, ${generateExpression((node.slots.value ?? [])[0], ctx)})`
  })
}
