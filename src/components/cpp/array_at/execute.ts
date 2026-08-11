/** `cpp:array_at` 的 **execute** 路——從共用檔原封剪過來（批次第三十八批）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import { defaultValue } from '../../../interpreter/types'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:array_at', async (node, ctx) => {
      const name = String(node.properties.obj)
      const indexNodes = node.children.index
      if (!indexNodes || indexNodes.length === 0) return defaultValue('int')

      const indexVal = await ctx.evaluate(indexNodes[0])
      const index = ctx.toNumber(indexVal)
      const container = ctx.scope.get(name)

      // String subscript: s[i] returns char
      if (container.type === 'string' && typeof container.value === 'string') {
        if (index < 0 || index >= container.value.length) {
          throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE, { '%1': String(index) })
        }
        return { type: 'char', value: container.value[index] }
      }

      if (container.type !== 'array' || !Array.isArray(container.value)) {
        throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
      }
      if (index < 0 || index >= container.value.length) {
        throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE, { '%1': String(index) })
      }
      return container.value[index]
    })
}
