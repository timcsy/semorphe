/**
 * `cpp:queue_back` 的 **execute** 路——從 `std/queue/executors.ts` 原封搬過來。
 *
 * ⚠️ **`defaultValue('int')` 是一筆靜默回退**（第三十三條護欄的形狀）：
 * 「佇列是空的」與「這根本不是佇列」都回同一個值。
 * **搬移不重寫**——原封搬過來，重寫要另一個 commit（見 `component-encapsulate`）。
 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import { defaultValue } from '../../../interpreter/types'

export function registerExecute(register: (concept: string, e: ConceptExecutor) => void): void {
  register('cpp:queue_back', async (node, ctx) => {
    const name = String(node.properties.obj)
    const arr = ctx.scope.get(name)
    if (arr.type !== 'array' || !Array.isArray(arr.value) || arr.value.length === 0) {
      return defaultValue('int')
    }
    return arr.value[arr.value.length - 1]
  })
}
