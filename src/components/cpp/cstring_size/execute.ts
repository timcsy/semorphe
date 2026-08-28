/** `cpp:cstring_size` 的 **execute** 路——從共用檔原封剪過來（批次第二批：lift 是 io.ts 的一個純資料分支）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:cstring_size', async (node, ctx) => {
      const strNodes = node.children.str ?? []
      if (strNodes.length === 0) return { type: 'int', value: 0 }
      const val = await ctx.evaluate(strNodes[0])

      // 🔴 **C 字串在執行期有兩種身體**：一個 `string` 值，或一顆 `char` 陣列。
      //
      // 在此之前這裡無條件 `String(val.value).length`，而對一顆陣列那會得到
      // `"[object Object],[object Object],…"` ——`char s[20] = "hello"` 的
      // `strlen` 因此回報 **319**（20 個物件各 15 字元 ＋ 19 個逗號）。
      //
      // > **一個錯的答案比一則錯誤訊息更糟：它跑完了、印出來了，
      // > 而沒有任何東西說它不對。**
      //
      // ⚠️ 而 C 的 `strlen` 數的是**到第一個 `\0` 為止**，不是配置的格數
      // ——`char s[20] = "hello"` 是 5，不是 20。這裡照著數。
      if (val.type === 'array' && Array.isArray(val.value)) {
        let n = 0
        for (const el of val.value as unknown[]) {
          const ch = el !== null && typeof el === 'object' && 'value' in el
            ? String((el as RuntimeValue).value)
            : String(el)
          if (ch === '' || ch === '\0') break
          n += ch.length
        }
        return { type: 'int', value: n }
      }
      return { type: 'int', value: String(val.value).length }
    })
}
