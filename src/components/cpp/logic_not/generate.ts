/** `cpp:logic_not` 的 **generate** 路——從共用檔原封剪過來（批次第三十二批：一元運算子族）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { precedence, genChild } from '../../../languages/cpp/core/generators/expressions'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:logic_not', (node, ctx) => {
      const operand = genChild((node.children.operand ?? [])[0], precedence(node), ctx)
      return `!${operand}`
    })
}
