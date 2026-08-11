/** `cpp:return` 的 **execute** 路——從共用檔原封剪過來（批次第三十五批）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import { defaultValue } from '../../../interpreter/types'
import { ReturnSignal } from '../../../interpreter/executors/functions'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:return', async (node, ctx) => {
      const valueNodes = node.children.value
      if (valueNodes && valueNodes.length > 0) {
        const val = await ctx.evaluate(valueNodes[0])
        throw new ReturnSignal(val)
      }
      throw new ReturnSignal(defaultValue('void'))
    })
}
