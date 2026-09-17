/** `cpp:container_count` 的 **execute** 路——從共用檔原封剪過來（批次第九批：容器方法資料表）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
import { mapFind } from '../../../languages/cpp/lang/runtime/map'
import { equivalentInOrder } from '../../../languages/cpp/lang/runtime/order'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:container_count', async (node, ctx) => {
      // 🔴 **接收者求值，不再解析一串文字**（2026-09-18）——見 `component.json` 的 `_slots_why`
      const keyNodes = node.slots.key ?? []
      if (keyNodes.length === 0) return { type: 'int' as const, value: 0 }
      const keyVal = await ctx.evaluate(keyNodes[0])
      const arr = await ctx.evaluate((node.slots.obj ?? [])[0])
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
      /**
       * 🔴 **可重複集合的 `count` 要數【全部】**（2026-09-18，盲測抓到）。
       *
       * C++ 的 `count` 回傳的是「有幾個」，而 `set`／`map` 的鍵唯一，
       * 所以那個數字只會是 0 或 1——**而 `multiset` 不是**。
       *
       * ⚠️ 症狀是**數字偏小而程式跑得完**：`ms.count(0)` 有兩個時回 1。
       * 而重複性住在容器的宣告上（`allowsDuplicates`），所以這裡讀它
       * ——與同族的 `insert`／`erase` 同一條判準。
       *
       * > **一個「有沒有」與一個「有幾個」在唯一鍵的容器上是同一個答案
       * > ——而那讓錯的那一半在大多數情況下看起來是對的。**
       */
      // ⚠️ 比較要問使用者自己的 `operator<`（與查找／去重同一份規則）
      let hits = 0
      for (const v of arr.value as RuntimeValue[]) {
        if (await equivalentInOrder(v, keyVal, ctx)) hits++
      }
      return { type: 'int' as const, value: arr.allowsDuplicates ? hits : (hits > 0 ? 1 : 0) }
    })
}
