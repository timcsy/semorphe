/** `cpp:range_find_upper` 的 **generate** 路 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { rangeEndsCode, slotCode } from '../../../languages/cpp/lang/runtime/range-lift'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:range_find_upper', (node, ctx) => {
      const [begin, end] = rangeEndsCode(node, ctx, generateExpression)
      const value = slotCode(node, 'value', ctx, generateExpression, '0')
      return `upper_bound(${begin}, ${end}, ${value})`
    })
}
