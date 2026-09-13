/** `cpp:loop_for` 的 **execute** 路——從共用檔原封剪過來（批次第二十四批：單一建立點 → 建構子）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { BreakSignal, ContinueSignal } from '../../../interpreter/executors/control-flow'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:loop_for', async (node, ctx) => {
      const body = node.slots.body ?? []
      const parentScope = ctx.scope
      const forScope = parentScope.createChild()
      ctx.scope = forScope

      if (node.slots.init && node.slots.init.length > 0) {
        await ctx.executeNode(node.slots.init[0])
      }

      while (true) {
        if (node.slots.cond && node.slots.cond.length > 0) {
          const condition = await ctx.evaluate(node.slots.cond[0])
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

        if (node.slots.update && node.slots.update.length > 0) {
          await ctx.executeNode(node.slots.update[0])
        }
      }
      ctx.scope = parentScope
    })
}
