/** `cpp:string_as_int` 的 **execute** 路——從共用檔原封剪過來（批次第六批：lift 是 io.ts 的一個帶真邏輯的分支）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:string_as_int', async (node, ctx) => {
      const valueNodes = node.children.value ?? []
      if (valueNodes.length === 0) return { type: 'int', value: 0 }
      const val = await ctx.evaluate(valueNodes[0])
      const n = parseInt(String(val.value), 10)
      if (isNaN(n)) throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'int' })
      return { type: 'int', value: n }
    })
}
