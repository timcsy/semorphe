/** `cpp:set_declare` 的 **execute** 路——從共用檔原封剪過來（批次第七批：容器樣板過渡表退場）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { cloneValue } from '../../../interpreter/clone'
import { registerContainerDefault } from '../../../languages/cpp/lang/runtime/container-defaults'
import type { RuntimeValue } from '../../../interpreter/types'
import { isAggregateList } from '../../../core/component/aggregate-nodes'
import { evalInitializer } from '../../../interpreter/aggregate'
import { asyncSort, equivalentInOrder, lessWithOverload } from '../../../languages/cpp/lang/runtime/order'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  /**
   * 🔴 **一個集合不一定經過宣告就會被建出來**（2026-09-18）：
   * `map<string, set<int>> b; b[k].insert(i);` 的那一格、
   * `vector<set<int>> bins(4);` 的每一格。
   *
   * 「集合不留重複、可重複集合留」是**這一顆的知識**——所以由它自己登記，
   * 而不是讓建它的那兩個地方各抄一份（那會是第三份與第四份真相）。
   */
  registerContainerDefault('set', (inner) => ({
    type: 'array', value: [], allowsDuplicates: false, ...(inner ? { elemType: inner } : {}),
  }))
  registerContainerDefault('multiset', (inner) => ({
    type: 'array', value: [], allowsDuplicates: true, ...(inner ? { elemType: inner } : {}),
  }))
  register('cpp:set_declare', async (node, ctx) => {
      const name = String(node.properties.name)
      // 🔴 **重複性跟著值走**（2026-09-17）：讀它的 `insert()` 只拿得到變數名，
      //    宣告那一行當時已經不在手上了。同 `heapOrder` 的處置。
      //    ⚠️ 舊存檔沒有這個屬性 ⟹ 是 `set`，不留重複。
      const allowsDuplicates = String(node.properties.unique ?? 'true') === 'false'
      // 🔴 **元素型別要跟著容器走**（2026-09-17）——同族那顆列表的宣告早就記了它。
      //    少了它，`st.insert({a, b})` 的大括號**不知道該變成什麼**，
      //    於是存進去一個陣列而不是一對值；而症狀出現在**下一個讀 `.first` 的人**身上：
      //    「it[0]（不是一個結構）」。語料的 `multiset<pair<int,int>>` 正是這個形狀。
      //
      // > **同一個概念有兩種執行期表示，症狀不會出現在建立它的那一邊，
      // > 而是出現在第一個同時看到兩邊的消費者身上。**
      // ⚠️ **退路要與宣告的 default 一致**（`type` 宣告了 `default: "int"`）。
      //    我第一版寫 `?? ''`，把同族那顆「不知道元素型別就不要假裝知道」的理由
      //    搬到了不適用的地方——那一顆讀的是**執行期**的 elemType（可能真的沒有），
      //    而這裡讀的是一個**有宣告預設值的屬性**。
      //    🟢 第一百一十九條護欄當場指名：「規格宣告的預設值與程式碼實際的退路不一樣
      //    ——規格在說謊。」
      const elemType = String(node.properties.type ?? 'int')
      /**
       * 🔴 **用另一個容器建起來**（2026-09-17）——`set<int> b = a;`／`map<char,int> r = f();`。
       * 在此之前這一行**無條件建一個空的**，而初始值連進不進得了語義樹都還不一定
       * （那一格沒有宣告，見 `component.json` 的 `_slots_why`）。
       *
       * ⚠️ **要複製，不能接管**：`cloneValue` 連裡面的一對值都複製。
       * 淺複製的話 `b.insert(x)` 之後 `a` 也多一個——而那種錯不會在建立的那一行出聲。
       * ⚠️ 而**種類跟著宣告走，不跟著來源走**：`multiset<int> b = s;`（`s` 是 `set`）
       * 之後 `b` 要留得住重複。
       */
      const source = (node.slots.source ?? [])[0]
      /**
       * 🔴 **大括號初始化不是「另一個容器」**（2026-09-18，盲測抓到）：
       * `set<int> s{3, 1, 3};` 要**排序並去重**（而可重複的那一種只排序）。
       * 原樣接管的話順序是寫的順序，重複也留著——**程式跑完，而走訪的順序是錯的**。
       */
      const cells: RuntimeValue[] = []
      if (source && isAggregateList(source.componentId)) {
        for (const el of source.slots.values ?? []) {
          const v = await evalInitializer(el, elemType, ctx)
          if (!allowsDuplicates) {
            let dup = false
            for (const c of cells) if (await equivalentInOrder(c, v, ctx)) { dup = true; break }
            if (dup) continue
          }
          cells.push(v)
        }
        const sorted = await asyncSort([...cells], (a, b) => lessWithOverload(a, b, ctx))
        cells.length = 0
        for (const v of sorted) cells.push(v)
      } else {
        const initial = source ? await ctx.evaluate(source) : null
        if (initial && initial.type === 'array' && Array.isArray(initial.value)) {
          for (const c of initial.value as RuntimeValue[]) cells.push(cloneValue(c))
        }
      }
      ctx.scope.declare(name, { type: 'array', value: cells, allowsDuplicates, elemType })
    })
}
