/** `cpp:string_at` 的 **execute** 路——從共用檔原封剪過來（批次第二十四批：單一建立點 → 建構子）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:string_at', async (node, ctx) => {
      const obj = String(node.properties.obj)
      const val = ctx.scope.get(obj)
      const str = String(val.value)
      const indexNodes = node.children.index ?? []
      const idx = indexNodes.length > 0 ? ctx.toNumber(await ctx.evaluate(indexNodes[0])) : 0
      if (idx < 0 || idx >= str.length) throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE)
      return { type: 'string', value: str[idx] }
    })
}
