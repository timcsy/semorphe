/** `cpp:ternary` 的 **execute** 路——從共用檔原封剪過來（批次第三十四批）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:ternary', async (node, ctx) => {
      const condNodes = node.children.condition ?? []
      const trueNodes = node.children.true_expr ?? []
      const falseNodes = node.children.false_expr ?? []
      if (condNodes.length === 0) return { type: 'int', value: 0 }

      const condition = await ctx.evaluate(condNodes[0])
      if (ctx.toBool(condition)) {
        return trueNodes.length > 0 ? await ctx.evaluate(trueNodes[0]) : { type: 'int', value: 0 }
      } else {
        return falseNodes.length > 0 ? await ctx.evaluate(falseNodes[0]) : { type: 'int', value: 0 }
      }
    })
}
