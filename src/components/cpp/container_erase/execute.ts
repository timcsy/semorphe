/** `cpp:container_erase` 的 **execute** 路——從共用檔原封剪過來（批次第九批：容器方法資料表）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { varRefName } from '../var_ref/lift'
import type { RuntimeValue } from '../../../interpreter/types'
import { mapFind } from '../../../languages/cpp/lang/runtime/map'
import { isCellPointer, offsetOf, sameCells, noteErasure, positionIn } from '../../../interpreter/pointer'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:container_erase', async (node, ctx) => {
      // 🔴 **接收者求值，不再解析一串文字**（2026-09-18）——見 `component.json` 的 `_slots_why`
      const keyNodes = node.slots.key ?? []
      if (keyNodes.length === 0) return
      const keyVal = await ctx.evaluate(keyNodes[0])
      const arr = await ctx.evaluate((node.slots.obj ?? [])[0])
      /**
       * ⚠️ **錯誤訊息要說得出是誰**——接收者變成接點之後，這裡不再有名字。
       * 🔴 而這一格差點靜默：`name` **是 DOM 的全域**，所以刪掉區域宣告之後
       * `${name}` 仍然編得過，只是在執行時變成 `undefined`。
       * > **一個被刪掉的區域變數，如果它的名字剛好是全域的，型別檢查不會報。**
       */
      const name = varRefName((node.slots.obj ?? [])[0]) ?? '這個接收者'
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
          noteErasure(cells, at)
          arr.value = cells.map((c) => String.fromCharCode(Number(c.value))).join('')
        }
        return positionIn(cells, at, { readonlyCells: true })
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
       * 「下一個」正好還是同一個 offset。
       *
       * 🔴 **而【別人手上】那些位置就不是這樣了**（2026-09-18，三支盲測同時指著它）：
       *
       * ```cpp
       * g.erase(it++);     // it 先往後挪一格，然後那一格被抽掉 ⟹ 整串左移
       * ```
       *
       * 挪過去的那個 offset 於是指到**再下一個**——`while` 走訪每刪一格就跳過一格，
       * 症狀是**數字偏小**（`pruned=1` 而 g++ 說 2），不是當掉。
       * 所以每一次真的抽掉一格都要 `noteErasure`，讓那些位置讀取時自己補算回來
       * （見 `RuntimeValue.era` 與 `pointer.ts` 的 `offsetOf`）。
       */
      /**
       * 🔴 **兩個位置界定一段範圍**（2026-09-18，盲測抓到）：`ms.erase(a, b)`。
       *
       * 這是同一個方法名的**第四種引數**。在此之前只讀了第一個引數，
       * 而症狀不是「少刪一些」——是 `before - after` 算出 **-358**，
       * 而那個容器的內容變成一串 `[object Object],…`。
       *
       * > **一個只讀第一個引數的方法，在收到兩個的時候不會出聲
       * > ——它會把第二個當成不存在，然後做一件完全不同的事。**
       *
       * ⚠️ C++ 的範圍是**半開**的：`[first, last)`，`last` 那一格不刪。
       */
      // 🔴 **結尾住在它自己的接點**（2026-09-18）。⚠️ 仍然收 `key` 的第二個孩子——
      //    舊存檔那一份是兩個擠在同一格。
      const endNode = (node.slots.key_end ?? [])[0] ?? keyNodes[1]
      const endVal = endNode ? await ctx.evaluate(endNode) : null
      if (isCellPointer(keyVal) && endVal && isCellPointer(endVal)) {
        if (!sameCells(keyVal, arr) || !sameCells(endVal, arr)) {
          throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, {
            '%1': `這兩個位置不是同一個「${name}」裡的，刪不了`,
          })
        }
        const from = offsetOf(keyVal)
        const to = offsetOf(endVal)
        if (to > from) {
          arr.value.splice(from, to - from)
          // ⚠️ 一次抽掉一段 ＝ **在同一個位置連抽 n 次**（每抽一次後面就補上來），
          //    所以通知也要送 n 次，否則別人手上的位置只會被修正一格。
          for (let i = 0; i < to - from; i++) noteErasure(arr.value, from)
        }
        // 回傳**最後一個被刪的之後**——那正好還是同一個 offset（與單格那一條同理）
        return positionIn(arr.value as RuntimeValue[], from)
      }
      if (isCellPointer(keyVal)) {
        if (!sameCells(keyVal, arr)) {
          throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, {
            '%1': `這個位置不是「${name}」裡的，刪不了`,
          })
        }
        const at = offsetOf(keyVal)
        if (at >= 0 && at < arr.value.length) {
          arr.value.splice(at, 1)
          noteErasure(arr.value, at)
        }
        return positionIn(arr.value as RuntimeValue[], at)
      }
      // Try map-style erase (key-value pairs) first
      const idx = mapFind(arr.value, keyVal)
      if (idx !== -1) {
        arr.value.splice(idx, 1)
        noteErasure(arr.value, idx)
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
        noteErasure(arr.value, i)
        if (!all) return
      }
    })
}
