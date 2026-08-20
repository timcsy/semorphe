/** `cpp:container_append` 的 **execute** 路——從共用檔原封剪過來（批次第九批：容器方法資料表）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'
import { evalInitializer } from '../../../interpreter/aggregate'

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:container_append', async (node, ctx) => {
      const name = String(node.properties.obj)
      const valueNodes = node.children.value ?? []
      if (valueNodes.length === 0) return
      const arr = ctx.scope.get(name)
      if (arr.type !== 'array' || !Array.isArray(arr.value)) {
        throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
      }
      // ⚠️ **先拿容器再求值**——`v.push_back({2,1})` 的 `{2,1}` 要變成什麼
      // 取決於容器裝的是什麼，而那個型別跟著容器的值走（`elemType`）。
      // 反過來寫的話，聚合初始化就沒有型別可依，只能猜。
      const val = await evalInitializer(valueNodes[0], arr.elemType ?? 'int', ctx)
      arr.value.push(val)
    })
}
