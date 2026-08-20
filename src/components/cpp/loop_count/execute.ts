/** `cpp:loop_count` 的 **execute** 路——從共用檔原封剪過來（批次第三十七批）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { BreakSignal, ContinueSignal } from '../../../interpreter/executors/control-flow'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:loop_count', async (node, ctx) => {
      const varName = String(node.properties.var_name)
      const from = ctx.toNumber(await ctx.evaluate(node.children.from[0]))
      const to = ctx.toNumber(await ctx.evaluate(node.children.to[0]))
      const body = node.children.body ?? []
      const parentScope = ctx.scope
      const inclusive = node.properties.inclusive === 'TRUE'

      for (let i = from; inclusive ? i <= to : i < to; i++) {
        ctx.scope = parentScope.createChild()
        ctx.scope.declare(varName, { type: 'int', value: i })
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
