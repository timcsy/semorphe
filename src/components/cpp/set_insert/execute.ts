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
import { isCellPointer, offsetOf, positionIn, sameCells } from '../../../interpreter/pointer'
import { makePair, mapFind, mapInsertSorted, pairParts } from '../../../languages/cpp/lang/runtime/map'
import { asyncSort, equivalentInOrder, lessWithOverload } from '../../../languages/cpp/lang/runtime/order'

/**
 * 🔴 **`insert` 回傳「位置 ＋ 有沒有真的插進去」**（2026-09-18，盲測抓到）。
 *
 * ```cpp
 * auto [it, ok] = m.insert({k, v});     // ok 為假 ⟹ 那個鍵本來就在
 * ```
 *
 * 這是 C++ 判斷「這次插入有沒有生效」的標準寫法——而在此之前這裡
 * 什麼都不回，於是結構化繫結說「這個值拆不開成『it, ok』」。
 *
 * ⚠️ **可重複的容器回的是單一個位置**（`multiset`／`multimap` 一定插得進去），
 *    而不是一對——那是 C++ 自己的差別，不是我們的簡化。
 */
function insertResult(
  cells: RuntimeValue[], at: number, inserted: boolean, container: RuntimeValue,
): RuntimeValue {
  const where = positionIn(cells, Math.max(0, at))
  // 可重複的容器（`multiset`／`multimap`）回的是單一個位置，不是一對。
  return container.allowsDuplicates === true
    ? where
    : makePair(where, { type: 'bool', value: inserted })
}

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
       * 🔴 **`v.insert(v.begin(), x)` 是【定位插入】**（2026-09-18）。
       *
       * 這一條的釘子上逐字寫著「🔴 何時該修：**迭代器那一刀做完的當天，
       * 回來拔這根釘子**」——而那一天到了，沒有人回來。
       *
       * > **一根釘子如果只寫著「誰擋住我」，它不會在那個人讓開的時候自己掉下來。**
       *
       * ⚠️ 而阻斷者讓開之後，缺陷**換了一個形狀**：位置不再是「不支援」，
       * 它變成了**要插入的那個值**——`v[0]` 印出來是一串格子。
       * **一個「還不認得」的東西，在它終於被造出來之後會被當成別的東西。**
       *
       * 判準與同族的刪除一致：**同一個方法名，由引數的種類決定做哪一件事**。
       */
      if (
        valueNodes.length >= 2 && arr.type === 'array' && Array.isArray(arr.value)
      ) {
        const at = await ctx.evaluate(valueNodes[0])
        if (isCellPointer(at)) {
          if (!sameCells(at, arr)) {
            throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, {
              '%1': `這個位置不是「${varRefName((node.slots.obj ?? [])[0]) ?? '這個接收者'}」裡的，插不進去`,
            })
          }
          const i = Math.max(0, Math.min(offsetOf(at), arr.value.length))
          const what = await evalInitializer(valueNodes[1], String(arr.elemType ?? ''), ctx)
          ;(arr.value as RuntimeValue[]).splice(i, 0, what)
          // C++ 回傳**指向新元素的位置**
          return positionIn(arr.value as RuntimeValue[], i)
        }
      }
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
         * 🟢 **`m.emplace(k, v)` 給的是【兩個引數】，不是一個大括號**
         *（2026-09-18，盲測抓到）。`insert` 也收得下這個形式。
         */
        if (valueNodes.length >= 2) {
          const k = await ctx.evaluate(valueNodes[0])
          const v = await ctx.evaluate(valueNodes[1])
          const had = mapFind(arr.value, k)
          // 🔴 **可重複的對照表（`multimap`）一定插得進去**——一個鍵可以有多個值。
          if (arr.allowsDuplicates === true || had === -1) mapInsertSorted(arr.value, makePair(k, v))
          return insertResult(arr.value as RuntimeValue[], mapFind(arr.value, k), had === -1, arr)
        }
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
        const had = mapFind(arr.value, parts.key)
        if (arr.allowsDuplicates === true || had === -1) mapInsertSorted(arr.value, braced)
        return insertResult(arr.value as RuntimeValue[], mapFind(arr.value, parts.key), had === -1, arr)
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
        const cells = arr.value as RuntimeValue[]
        for (let i = 0; i < cells.length; i++) {
          if (await equivalentInOrder(cells[i], val, ctx)) return insertResult(cells, i, false, arr)
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
      let at = 0
      for (let i = 0; i < sorted.length; i++) if (sorted[i] === val) { at = i; break }
      return insertResult(arr.value as RuntimeValue[], at, true, arr)
    })
}
