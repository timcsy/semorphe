/** `cpp:container_push` 的 **execute** 路——從共用檔原封剪過來（批次第三十五批）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:container_push', async (node, ctx) => {
      const name = String(node.properties.obj)
      const valueNodes = node.children.value ?? []
      if (valueNodes.length === 0) return
      const val = await ctx.evaluate(valueNodes[0])
      const arr = ctx.scope.get(name)
      if (arr.type !== 'array' || !Array.isArray(arr.value)) {
        throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
      }
      arr.value.push(val)
    })
}
