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
import { varRefName } from '../var_ref/lift'
import { evalInitializer } from '../../../interpreter/aggregate'
import type { RuntimeValue } from '../../../interpreter/types'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'
import { makePair, mapFind, mapInsertSorted, pairParts } from '../../../languages/cpp/lang/runtime/map'
import { asyncSort, equivalentInOrder, lessWithOverload } from '../../../languages/cpp/lang/runtime/order'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:set_insert', async (node, ctx) => {
      // 🔴 **接收者求值，不再解析一串文字**（2026-09-18）——見 `component.json` 的 `_slots_why`
      const valueNodes = node.slots.value ?? []
      if (valueNodes.length === 0) return
      /**
       * 🔴 **大括號要知道自己該變成什麼**（2026-09-17）——同族那顆在末端加入的
       * 元件早就走這條路了，而這裡走的是裸的求值。
       *
       * 於是 `multiset<pair<int,int>> st; st.insert({a, b});` 存進去一個**陣列**，
       * 而 `it->first` 在它上面說「不是一個結構」。
       *
       * ⚠️ `?? ''` 不是筆誤：**不知道元素型別就不要假裝知道**（見同族那顆的註解，
       * 那裡曾經寫 `?? 'int'`，於是字串元素被壓成 0）。
       */
      // ⚠️ **接收者要先解析**：要拿它的元素型別去讀那個大括號。
      const arr = await ctx.evaluate((node.slots.obj ?? [])[0])
      /**
       * ⚠️ **錯誤訊息要說得出是誰**——接收者變成接點之後，這裡不再有名字。
       * 🔴 而這一格差點靜默：`name` **是 DOM 的全域**，所以刪掉區域宣告之後
       * `${name}` 仍然編得過，只是在執行時變成 `undefined`。
       * > **一個被刪掉的區域變數，如果它的名字剛好是全域的，型別檢查不會報。**
       */
      const name = varRefName((node.slots.obj ?? [])[0]) ?? '這個接收者'
      if (arr.type !== 'array' || !Array.isArray(arr.value)) {
        throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
      }
      const val = await evalInitializer(valueNodes[0], String(arr.elemType ?? ''), ctx)
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
      /**
       * 🔴 **「是不是同一個」的判準是 `!(a<b) && !(b<a)`，不是 `==`**（2026-09-18）。
       *
       * `set` 從頭到尾沒有用到 `operator==`。而只比 `.value` 的寫法對**物件**
       * 永遠回 false（兩個 Map 不是同一個參考），於是
       * `set<T> s; s.insert(T(3)); s.insert(T(3));` 留了兩個——**靜默地**。
       */
      if (!arr.allowsDuplicates) {
        for (const v of arr.value as RuntimeValue[]) {
          if (await equivalentInOrder(v, val, ctx)) return
        }
      }
      arr.value.push(val)
      /**
       * 兩種都是**有序**容器——差別只在留不留重複。
       * 🔴 **而順序也要問使用者自己的 `operator<`**（同上）：`set<T>` 在此之前
       * 完全沒有依它排。⚠️ 排序與查找要用**同一條**規則，否則「放進去的順序」
       * 與「找出來的位置」會對不上。
       */
      // ⚠️ **傳一份複本進去**：`asyncSort` 在長度 ≤1 時回傳的就是傳進去的那個陣列，
      //    而下面要先清空它——清掉的會是同一個。
      const sorted = await asyncSort([...(arr.value as RuntimeValue[])], (a, b) => lessWithOverload(a, b, ctx))
      arr.value.length = 0
      for (const v of sorted) (arr.value as RuntimeValue[]).push(v)
    })
}
