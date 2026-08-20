/** `cpp:set_insert` 的 **execute** 路——從共用檔原封剪過來（批次第九批：容器方法資料表）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:set_insert', async (node, ctx) => {
      const name = String(node.properties.obj)
      const valueNodes = node.children.value ?? []
      if (valueNodes.length === 0) return
      const val = await ctx.evaluate(valueNodes[0])
      const arr = ctx.scope.get(name)
      if (arr.type !== 'array' || !Array.isArray(arr.value)) {
        throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
      }
      // Uniqueness check: compare by value
      const exists = arr.value.some((v: RuntimeValue) => v.value === val.value)
      if (!exists) {
        arr.value.push(val)
        // Keep sorted (by value)
        arr.value.sort((a: RuntimeValue, b: RuntimeValue) => {
          if (typeof a.value === 'number' && typeof b.value === 'number') return a.value - b.value
          return String(a.value).localeCompare(String(b.value))
        })
      }
    })
}
