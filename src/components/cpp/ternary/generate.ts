/** `cpp:ternary` 的 **generate** 路——從共用檔原封剪過來（批次第三十四批）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:ternary', (node, ctx) => {
      const cond = generateExpression((node.children.condition ?? [])[0], ctx)
      const trueExpr = generateExpression((node.children.true_expr ?? [])[0], ctx)
      const falseExpr = generateExpression((node.children.false_expr ?? [])[0], ctx)
      return `${cond} ? ${trueExpr} : ${falseExpr}`
    })
}
