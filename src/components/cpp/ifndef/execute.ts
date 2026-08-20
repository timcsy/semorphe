/** `cpp:ifndef` 的 **execute** 路——從共用檔原封剪過來（批次第二十三批：前置處理指令 → 身分）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { defined } from '../../../languages/cpp/core/executors/preprocessor'

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:ifndef', async (node, ctx) => {
      const name = String(node.properties.condition ?? '')
      if (!defined.has(name)) await ctx.executeBody(node.children.body ?? [])
    })
}
