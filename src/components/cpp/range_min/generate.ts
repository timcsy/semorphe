/** `cpp:range_min` 的 **generate** 路 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { rangeEndsCode } from '../../../languages/cpp/lang/runtime/range-lift'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:range_min', (node, ctx) => {
      const [begin, end] = rangeEndsCode(node, ctx, generateExpression)
      return `min_element(${begin}, ${end})`
    })
}
