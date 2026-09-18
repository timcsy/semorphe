/** `cpp:range_fill` 的 **generate** 路——從共用檔原封剪過來（批次第八批：io.ts 的帶判別分支（括號形式／方法引數個數消歧））。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { rangeEndsCode } from '../../../languages/cpp/lang/runtime/range-lift'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:range_fill', (node, ctx) => {
      const [begin, end] = rangeEndsCode(node, ctx, generateExpression)
      const valueNodes = node.slots.value ?? []
      const value = valueNodes.length > 0 ? generateExpression(valueNodes[0], ctx) : '0'
      return `${indent(ctx)}fill(${begin}, ${end}, ${value});\n`
    })
}
