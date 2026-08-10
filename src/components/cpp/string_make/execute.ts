/** `cpp:string_make` 的 **execute** 路——從共用檔原封剪過來（批次第六批：lift 是 io.ts 的一個帶真邏輯的分支）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:string_make', async (node, ctx) => {
      const valueNodes = node.children.value ?? []
      if (valueNodes.length === 0) return { type: 'string', value: '' }
      const val = await ctx.evaluate(valueNodes[0])
      return { type: 'string', value: String(val.value) }
    })
}
