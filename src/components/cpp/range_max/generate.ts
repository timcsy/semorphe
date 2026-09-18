/** `cpp:range_max` 的 **generate** 路 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { rangeEndsCode } from '../../../languages/cpp/lang/runtime/range-lift'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:range_max', (node, ctx) => {
      const [begin, end] = rangeEndsCode(node, ctx, generateExpression)
      return `max_element(${begin}, ${end})`
    })
}
