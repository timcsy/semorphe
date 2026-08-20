/** `cpp:loop_for` 的 **execute** 路——從共用檔原封剪過來（批次第二十四批：單一建立點 → 建構子）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { BreakSignal, ContinueSignal } from '../../../interpreter/executors/control-flow'

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:loop_for', async (node, ctx) => {
      const body = node.children.body ?? []
      const parentScope = ctx.scope
      const forScope = parentScope.createChild()
      ctx.scope = forScope

      if (node.children.init && node.children.init.length > 0) {
        await ctx.executeNode(node.children.init[0])
      }

      while (true) {
        if (node.children.cond && node.children.cond.length > 0) {
          const condition = await ctx.evaluate(node.children.cond[0])
          if (!ctx.toBool(condition)) break
        }

        ctx.scope = forScope.createChild()
        try {
          await ctx.executeBody(body)
        } catch (signal) {
          if (signal instanceof BreakSignal) { ctx.scope = forScope; break }
          if (signal instanceof ContinueSignal) {
            // fall through to update
          } else {
            ctx.scope = parentScope
            throw signal
          }
        }
        ctx.scope = forScope

        if (node.children.update && node.children.update.length > 0) {
          await ctx.executeNode(node.children.update[0])
        }
      }
      ctx.scope = parentScope
    })
}
