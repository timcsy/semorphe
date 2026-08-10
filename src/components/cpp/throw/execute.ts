/** `cpp:throw` 的 **execute** 路——從共用檔原封剪過來（批次第一批）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import { ThrownSignal } from '../../../languages/cpp/core/executors/control-flow'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:throw', async (node, ctx) => {
      const vals = node.children.value ?? []
      const value = vals.length > 0 ? await ctx.evaluate(vals[0]) : 'exception'
      throw new ThrownSignal(value)
    })
}
