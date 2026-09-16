/** `cpp:array_assign` 的 **execute** 路——從共用檔原封剪過來（批次第三十七批）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { receiverOf } from '../../../interpreter/receiver'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'
import { evalInitializer } from '../../../interpreter/aggregate'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:array_assign', async (node, ctx) => {
      const name = String(node.properties.obj)
      const indexNodes = node.slots.index
      const valueNodes = node.slots.value
      if (!indexNodes || indexNodes.length === 0 || !valueNodes || valueNodes.length === 0) return

      const indexVal = await ctx.evaluate(indexNodes[0])
      const index = ctx.toNumber(indexVal)
      const container = receiverOf(ctx.scope, name)
      /**
       * 🔴 **大括號要照那一格的型別填**（2026-09-16）。
       *
       * `pair<int,int> A[10]; A[0] = {3, 1};` 在此之前直接 `evaluate`，
       * 拿到一個**陣列**塞進那一格——於是 `A[0].first` 拋「不是一個結構」。
       *
       * ⚠️ `evalInitializer` 對不是大括號的節點就是原本那條
       * `coerceType(evaluate(…))`，所以這不是行為變更。
       */
      const val = await evalInitializer(valueNodes[0], String(container.elemType ?? 'int'), ctx)

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
