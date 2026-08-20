/** `cpp:loop_range` 的 **execute** 路——從共用檔原封剪過來（批次第三批：lift 是只產一種身分的具名策略）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { BreakSignal, ContinueSignal } from '../../../interpreter/executors/control-flow'

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:loop_range', async (node, ctx) => {
      const varName = String(node.properties.var_name ?? 'x')
      const containerName = String(node.properties.container ?? 'vec')
      const body = node.children.body ?? []
      const parentScope = ctx.scope
      const container = ctx.scope.get(containerName)

      if (container.type === 'array' && Array.isArray(container.value)) {
        for (const elem of container.value) {
          ctx.scope = parentScope.createChild()
          ctx.scope.declare(varName, elem)
          try {
            await ctx.executeBody(body)
          } catch (signal) {
            if (signal instanceof BreakSignal) break
            if (signal instanceof ContinueSignal) continue
            ctx.scope = parentScope
            throw signal
          }
        }
      }
      ctx.scope = parentScope
    })
}
