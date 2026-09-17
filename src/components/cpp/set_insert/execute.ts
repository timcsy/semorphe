/**
 * `cpp:set_insert` 的 **execute** 路。
 *
 * ## 🔴 它一度對每一種容器做同一件事（2026-09-17 修）
 *
 * 這一支是「`insert` 這個方法名」的唯一主人，而它的實作**無條件**去重＋排序：
 *
 * ```
 * multiset<int> ms; ms.insert(3); ms.insert(3);    g++ 兩個 ／ 我們一個
 * ```
 *
 * 語料裡 `multiset<` 13 支——**程式跑得動、印得出東西，而答案少一半**。
 *
 * 拍板的判準是 C++ 自己的：同一個方法名 `insert`，行為由**接收者的型別**決定。
 * 所以重複性住在**容器的宣告**上，這裡只負責讀它。
 *
 * > **同一個名字在不同容器上做不同的事，那個差別屬於容器，不屬於名字。**
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { receiverOf } from '../../../interpreter/receiver'
import type { RuntimeValue } from '../../../interpreter/types'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'
import { makePair, mapFind, mapInsertSorted, pairParts } from '../../../languages/cpp/lang/runtime/map'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:set_insert', async (node, ctx) => {
      const name = String(node.properties.obj)
      const valueNodes = node.slots.value ?? []
      if (valueNodes.length === 0) return
      const val = await ctx.evaluate(valueNodes[0])
      const arr = receiverOf(ctx.scope, name)
      if (arr.type !== 'array' || !Array.isArray(arr.value)) {
        throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
      }
      // 🔴 **對應表那一族**：條目是鍵值對，而 C++ 的 `map::insert` 在鍵已存在時
      //    **什麼都不做**（它不覆蓋——那是 `m[k] = v` 的事）。
      if (arr.keyed) {
        /**
         * ⚠️ **`m.insert({3, 7})` 的大括號求值出來是一串值，不是一對**
         *    ——學生寫的正是這個形式（`make_pair` 是課本的寫法）。
         *    兩個元素的那一串，在對照表的 `insert` 上就是「鍵, 值」。
         *    🔴 而這個轉換**只在 `keyed` 成立時做**：`multiset<pair<int,int>>`
         *    收到同樣的一串時，那是一個元素而不是一對。
         */
        const braced = val.type === 'array' && Array.isArray(val.value) && val.value.length === 2
          ? makePair(val.value[0], val.value[1])
          : val
        const parts = pairParts(braced)
        if (!parts) {
          throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, {
            '%1': `「${name}」是對照表，它的 insert 要一對「鍵, 值」`,
          })
        }
        if (mapFind(arr.value, parts.key) === -1) mapInsertSorted(arr.value, braced)
        return
      }
      // 🔴 **未設 ＝ 這不是關聯容器**，而不是「預設不留重複」。
      //    `v.insert(...)` 也會走到這裡（方法名只有一個主人），而 C++ 的
      //    `vector::insert` 是**定位插入**，不是去重排序。判不出來就出聲——
      //    安靜地當成集合處理的話，學生的 vector 會被重新排過。
      if (arr.allowsDuplicates === undefined) {
        throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, {
          '%1': `「${name}」不是集合或對照表，而 insert 目前只做得了它們的插入`
            + `（vector 的定位插入要先有迭代器）`,
        })
      }
      if (!arr.allowsDuplicates && arr.value.some((v: RuntimeValue) => v.value === val.value)) return
      arr.value.push(val)
      // 兩種都是**有序**容器——差別只在留不留重複。
      arr.value.sort((a: RuntimeValue, b: RuntimeValue) => {
        if (typeof a.value === 'number' && typeof b.value === 'number') return a.value - b.value
        return String(a.value).localeCompare(String(b.value))
      })
    })
}
