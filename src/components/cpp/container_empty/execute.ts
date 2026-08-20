/** `cpp:container_empty` 的 **execute** 路——從共用檔原封剪過來（批次第九批：容器方法資料表）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:container_empty', async (node, ctx) => {
      const name = String(node.properties.obj)
      const arr = ctx.scope.get(name)

      // **字串也是容器**。`s.empty()` 走這條路（容器方法表按方法名分派，
      // 不按接收者型別），而它原本落進下面那個「不是 array 就回 true」。
      //
      // 🔴 症狀：`if (from.empty()) return s;` 對一個**非空**的字串成立，
      // 於是整個 `replaceAll` 一次都沒替換就回傳了——而輸出是原字串，
      // **看起來像「沒有東西需要替換」**。第三十二條護欄的誤差 1 筆。
      if (arr.type === 'string') {
        return { type: 'bool', value: String(arr.value).length === 0 }
      }

      if (arr.type !== 'array' || !Array.isArray(arr.value)) {
        // ⚠️ **出聲，不要回 true。** 這裡原本無條件回 `true`，而那與
        // 「容器真的是空的」在畫面上一模一樣——上面那個 `replaceAll`
        // 就是這樣安靜地什麼都沒做。
        //
        // > **一個回退值若剛好是某些情況的正確答案，它會偽裝成正確很久。**
        const { RuntimeError, RUNTIME_ERRORS } = await import('../../../interpreter/errors')
        throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': `${name}（${arr.type} 不是容器）` })
      }
      return { type: 'bool', value: arr.value.length === 0 }
    })
}
