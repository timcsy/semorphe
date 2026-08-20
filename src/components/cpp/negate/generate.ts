/** `cpp:negate` 的 **generate** 路——從共用檔原封剪過來（批次第三十二批：一元運算子族）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { precedence, genChild } from '../../../languages/cpp/core/generators/expressions'
// ⚠️ 問**性狀**不問身分——一顆膠囊裡列另外兩顆的身分，就近性護欄的反向檢查會指名。
import { isPrefixOperator } from '../../../languages/cpp/core/node-traits'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:negate', (node, ctx) => {
      const op = (node.properties.operator as string) ?? '-'
      const childNode = (node.children.value ?? node.children.operand ?? [])[0]
      const val = genChild(childNode, precedence(node), ctx)
      // Prevent --x (pre-decrement) or ++x when nesting unary operators
      if (childNode && isPrefixOperator(childNode.componentId)) {
        return `${op}(${val})`
      }
      return `${op}${val}`
    })
}
