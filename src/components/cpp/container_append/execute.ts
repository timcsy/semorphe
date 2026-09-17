/** `cpp:container_append` 的 **execute** 路——從共用檔原封剪過來（批次第九批：容器方法資料表）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'
import { evalInitializer } from '../../../interpreter/aggregate'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:container_append', async (node, ctx) => {
      /**
       * 🔴 **接收者求值，不再解析一串文字**（2026-09-18）。
       *
       * ⚠️ **求出來的必須是【同一個物件】**：`push` 是原地改。
       * `ctx.evaluate` 對一個變數參照回傳的就是作用域裡那一份
       * （聚合值不複製——複製只發生在傳值那一刻，見 `interpreter/clone.ts`），
       * 所以下面的 `arr.value.push(...)` 改到的是使用者的容器。
       */
      const objNodes = node.slots.obj ?? []
      const valueNodes = node.slots.value ?? []
      if (valueNodes.length === 0 || objNodes.length === 0) return
      const arr = await ctx.evaluate(objNodes[0])
      if (arr.type !== 'array' || !Array.isArray(arr.value)) {
        throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
      }
      // ⚠️ **先拿容器再求值**——`v.push_back({2,1})` 的 `{2,1}` 要變成什麼
      // 取決於容器裝的是什麼，而那個型別跟著容器的值走（`elemType`）。
      // 反過來寫的話，聚合初始化就沒有型別可依，只能猜。
      const val = await evalInitializer(valueNodes[0], /**
       * 🔴 **不知道元素型別就【不要假裝知道】**（2026-09-16，模糊測試抓到的）。
       *
       * 這裡曾經寫 `?? 'int'`，於是 `deque<string> d; d.push_back("ab");`
       * 的元素被 `coerceType(…, 'int')` **壓成 0**——程式跑完、印出東西、而它是錯的。
       * （`deque` 至今沒有被登錄成容器樣板，所以它的 `elemType` 是空的。）
       *
       * > **一個「不知道就用預設值」的回退，在預設值剛好是別的型別時
       * > 不會報錯——它會安靜地把資料換掉。**
       *
       * 🟢 空字串會走 `coerceType` 的 default，原樣回傳——**知道才壓，不知道就不動**。
       */
      arr.elemType ?? '', ctx)
      arr.value.push(val)
    })
}
