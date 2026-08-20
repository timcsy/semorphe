/** `cpp:loop_do_while` 的 **execute** 路——從共用檔原封剪過來（批次第一批）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { BreakSignal, ContinueSignal } from '../../../interpreter/executors/control-flow'

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:loop_do_while', async (node, ctx) => {
      const body = node.children.body ?? []
      const condNodes = node.children.cond ?? []
      const parentScope = ctx.scope
      do {
        ctx.scope = parentScope.createChild()
        try {
          await ctx.executeBody(body)
        } catch (signal) {
          if (signal instanceof BreakSignal) { ctx.scope = parentScope; return }
          if (signal instanceof ContinueSignal) { /* fall through to condition check */ }
          else { ctx.scope = parentScope; throw signal }
        }
        if (condNodes.length === 0) break
      } while (ctx.toBool(await ctx.evaluate(condNodes[0])))
      ctx.scope = parentScope
    })
}
