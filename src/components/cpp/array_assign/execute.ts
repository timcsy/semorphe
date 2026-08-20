/** `cpp:array_assign` 的 **execute** 路——從共用檔原封剪過來（批次第三十七批）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:array_assign', async (node, ctx) => {
      const name = String(node.properties.obj)
      const indexNodes = node.children.index
      const valueNodes = node.children.value
      if (!indexNodes || indexNodes.length === 0 || !valueNodes || valueNodes.length === 0) return

      const indexVal = await ctx.evaluate(indexNodes[0])
      const index = ctx.toNumber(indexVal)
      const val = await ctx.evaluate(valueNodes[0])
      const container = ctx.scope.get(name)

      // String subscript assign: s[i] = 'x'
      if (container.type === 'string' && typeof container.value === 'string') {
        if (index < 0 || index >= container.value.length) {
          throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE, { '%1': String(index) })
        }
        const ch = typeof val.value === 'string' ? val.value[0] ?? '' : String.fromCharCode(ctx.toNumber(val))
        const chars = container.value.split('')
        chars[index] = ch
        ctx.scope.set(name, { type: 'string', value: chars.join('') })
        return
      }

      if (container.type !== 'array' || !Array.isArray(container.value)) {
        throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
      }
      if (index < 0 || index >= container.value.length) {
        throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE, { '%1': String(index) })
      }
      container.value[index] = val
    })
}
