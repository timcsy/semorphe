/** `cpp:comma_expr` 的 **generate** 路——從共用檔原封剪過來（批次第三十四批）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:comma_expr', (node, ctx) => {
      const exprs = (node.children.exprs ?? []).map(e => generateExpression(e, ctx))
      return exprs.join(', ')
    })
}
