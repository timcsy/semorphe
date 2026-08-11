/** `cpp:comma_expr` 的 **execute** 路——從共用檔原封剪過來（批次第三十四批）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:comma_expr', async (node, ctx) => {
      const exprs = node.children.exprs ?? []
      let last: import('../../../interpreter/types').RuntimeValue = { type: 'int', value: 0 }
      for (const expr of exprs) {
        last = (await ctx.executeNode(expr)) as import('../../../interpreter/types').RuntimeValue ?? last
      }
      return last
    })
}
