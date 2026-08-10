/** `cpp:loop_while` 的 **execute** 路——從共用檔原封剪過來（批次第十二批：lift 是一整筆 pattern）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import { BreakSignal, ContinueSignal } from '../../../interpreter/executors/control-flow'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:loop_while', async (node, ctx) => {
      const body = node.children.body ?? []
      const parentScope = ctx.scope
      while (true) {
        ctx.scope = parentScope.createChild()
        const condition = await ctx.evaluate(node.children.condition[0])
        if (!ctx.toBool(condition)) break
        try {
          await ctx.executeBody(body)
        } catch (signal) {
          if (signal instanceof BreakSignal) break
          if (signal instanceof ContinueSignal) continue
          await ctx.exitScope(ctx.scope, parentScope)
          throw signal
        }
      }
      await ctx.exitScope(ctx.scope, parentScope)
    })
}
