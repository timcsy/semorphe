/** `cpp:container_count` 的 **execute** 路——從共用檔原封剪過來（批次第九批：容器方法資料表）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
import { mapFind } from '../../../languages/cpp/core/executors/containers'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:container_count', async (node, ctx) => {
      const name = String(node.properties.obj)
      const keyNodes = node.children.key ?? []
      if (keyNodes.length === 0) return { type: 'int' as const, value: 0 }
      const keyVal = await ctx.evaluate(keyNodes[0])
      const arr = ctx.scope.get(name)
      if (arr.type !== 'array' || !Array.isArray(arr.value)) {
        // ⚠️ **這裡原本靜靜回 0**——於是「這個容器裡沒有那個鍵」與
        // 「這根本不是容器」長得一模一樣。那正是 `specs/109` 修過的那個病
        // （`s.size()` 在字串上被判成 vector，而 vector 的執行器回 0 →
        // `for(i<s.size())` 一次都不跑）。
        //
        // 它一直都在，只是**藏在共用檔裡看不清楚**——搬進膠囊之後
        // 第三十三條護欄把它從「缺子節點」重新分類成「型別不符」，當場現形。
        //
        // > **沉默的正確和沉默的缺失撞在一起時，讓正確的那個說話。**
        throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'container' })
      }
      // Try map-style count (key-value pairs) first
      const idx = mapFind(arr.value, keyVal)
      if (idx !== -1) return { type: 'int' as const, value: 1 }
      // Set-style count (direct value match)
      const exists = arr.value.some((v: RuntimeValue) => v.value === keyVal.value)
      return { type: 'int' as const, value: exists ? 1 : 0 }
    })
}
