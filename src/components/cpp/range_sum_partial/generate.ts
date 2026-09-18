/** `cpp:range_sum_partial` 的 **generate** 路——從共用檔原封剪過來（批次第六批：lift 是 io.ts 的一個帶真邏輯的分支）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { rangeEndsCode, slotCode } from '../../../languages/cpp/lang/runtime/range-lift'
import { generateExpression } from '../../../core/projection/code-generator'
import { indent } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:range_sum_partial', (node, ctx) => {
      const [begin, end] = rangeEndsCode(node, ctx, generateExpression)
      const dest = slotCode(node, 'dest', ctx, generateExpression, 'result.begin()')
      return `${indent(ctx)}partial_sum(${begin}, ${end}, ${dest});\n`
    })
}
