/** `cpp:container_erase` 的 **execute** 路——從共用檔原封剪過來（批次第九批：容器方法資料表）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { receiverOf } from '../../../interpreter/receiver'
import type { RuntimeValue } from '../../../interpreter/types'
import { mapFind } from '../../../languages/cpp/lang/runtime/map'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:container_erase', async (node, ctx) => {
      const name = String(node.properties.obj)
      const keyNodes = node.slots.key ?? []
      if (keyNodes.length === 0) return
      const keyVal = await ctx.evaluate(keyNodes[0])
      const arr = receiverOf(ctx.scope, name)
      if (arr.type !== 'array' || !Array.isArray(arr.value)) return
      // Try map-style erase (key-value pairs) first
      const idx = mapFind(arr.value, keyVal)
      if (idx !== -1) {
        arr.value.splice(idx, 1)
        return
      }
      /**
       * 🔴 **`multiset::erase(key)` 刪掉【全部】等於那個鍵的**（2026-09-17）。
       *
       * 這一條在 `multiset` 能留重複之前**看起來是對的**：容器裡本來就只有一個，
       * 刪一個與刪全部沒有差別。支援重複性的那一刻，它變成一個錯的答案
       * ——而它不當掉，只是 `size()` 多了一。
       *
       * > **一個「只有在另一個缺陷存在時才正確」的實作，
       * > 會在那個缺陷被修好的當天變成新的缺陷。**
       *
       * ⚠️ 探索報告點過名（「`multiset` 的 `erase(x)` 刪掉全部，而 `erase(iterator)`
       * 只刪一個——這一刀不碰 `erase`」）。迭代器那一半仍然沒做，而**這一半現在非做不可**。
       */
      const all = arr.allowsDuplicates === true
      for (let i = arr.value.length - 1; i >= 0; i--) {
        if ((arr.value[i] as RuntimeValue).value !== keyVal.value) continue
        arr.value.splice(i, 1)
        if (!all) return
      }
    })
}
