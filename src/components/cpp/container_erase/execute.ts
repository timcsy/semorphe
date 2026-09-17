/** `cpp:container_erase` 的 **execute** 路——從共用檔原封剪過來（批次第九批：容器方法資料表）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { receiverOf } from '../../../interpreter/receiver'
import type { RuntimeValue } from '../../../interpreter/types'
import { mapFind } from '../../../languages/cpp/lang/runtime/map'
import { isCellPointer, offsetOf, sameCells } from '../../../interpreter/pointer'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:container_erase', async (node, ctx) => {
      const name = String(node.properties.obj)
      const keyNodes = node.slots.key ?? []
      if (keyNodes.length === 0) return
      const keyVal = await ctx.evaluate(keyNodes[0])
      const arr = receiverOf(ctx.scope, name)
      /**
       * 🔴 **一段文字也刪得掉一個位置**（2026-09-17，盲測抓到）：
       *
       * ```cpp
       * string::iterator it = s.begin(); ++it;
       * it = s.erase(it);        // 拿掉一個字，並回傳下一個位置
       * ```
       *
       * 🟢 格子是**同一份**（延遲攤出來、存在那個值身上），所以在它上面
       *    原地刪一格，**既有的位置看得到那個改動**——文字再由格子重建。
       * ⚠️ 而那正是走訪那一路要的：`while (it != s.end())` 的 `end()`
       *    每次都重新問，長度會跟著變。
       */
      if (arr.type === 'string' && typeof arr.value === 'string' && isCellPointer(keyVal)) {
        const cells = arr.charCells
        if (!cells || keyVal.value !== cells) {
          throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, {
            '%1': `這個位置不是「${name}」裡的，刪不了`,
          })
        }
        const at = offsetOf(keyVal)
        if (at >= 0 && at < cells.length) {
          cells.splice(at, 1)
          arr.value = cells.map((c) => String.fromCharCode(Number(c.value))).join('')
        }
        return { type: 'array', value: cells, offset: at, readonlyCells: true }
      }
      if (arr.type !== 'array' || !Array.isArray(arr.value)) return
      /**
       * 🔴 **`erase(位置)` 只刪那一格**（2026-09-17）——而 `erase(鍵)` 在
       * 可重複集合上刪**全部**。同一個方法名，由**引數的種類**決定做哪一件事。
       *
       * 語料最常見的寫法正是這一個：`ms.erase(ms.find(v))`
       * ——「刪掉一個等於 v 的」，而不是「刪掉全部等於 v 的」。
       *
       * ⚠️ 少了這一條的症狀是**數量錯一個**：`erase(find(v))` 會沿著下面那條
       * 走成「刪全部」，於是一個計數少掉的不只一個。**程式跑完，數字偏小。**
       *
       * 🟢 回傳**下一個位置**（C++11 起的行為）：我們把那一格抽掉之後，
       * 「下一個」正好還是同一個 offset。⚠️ 那是**剛好對**，不是設計出來的
       * ——下一個人改這裡的刪除方式時要知道有東西靠著它。
       */
      if (isCellPointer(keyVal)) {
        if (!sameCells(keyVal, arr)) {
          throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, {
            '%1': `這個位置不是「${name}」裡的，刪不了`,
          })
        }
        const at = offsetOf(keyVal)
        if (at >= 0 && at < arr.value.length) arr.value.splice(at, 1)
        return { type: 'array', value: arr.value, offset: at }
      }
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
