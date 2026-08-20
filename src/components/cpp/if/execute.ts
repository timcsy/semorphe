/** `cpp:if` 的 **execute** 路——從共用檔原封剪過來（批次第四十批）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:if', async (node, ctx) => {
      const condition = await ctx.evaluate(node.children.condition[0])
      if (ctx.toBool(condition)) {
        await ctx.executeBody(node.children.then_body ?? [])
      } else {
        await ctx.executeBody(node.children.else_body ?? [])
      }
    })
}
