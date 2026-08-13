/** `cpp:string_at` 的 **execute** 路——從共用檔原封剪過來（批次第二十四批：單一建立點 → 建構子）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:string_at', async (node, ctx) => {
      const obj = String(node.properties.obj)
      const val = ctx.scope.get(obj)
      const str = String(val.value)
      const indexNodes = node.children.index ?? []
      const idx = indexNodes.length > 0 ? ctx.toNumber(await ctx.evaluate(indexNodes[0])) : 0
      if (idx < 0 || idx >= str.length) throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE)
      // ⚠️ `s[i]` 的型別是 **char**，而 char 在這個直譯器裡是**碼位（數字）**
      // ——`cpp:literal_char` 就是那樣回的（`{ type: 'char', value: ch.charCodeAt(0) }`）。
      //
      // 🔴 這裡原本回 `{ type: 'string', value: 'a' }`，於是 `s[i] - 32` 走
      // `toNumber` 的 `Number('a') || 0` **變成 0**，算出 -32。
      // 而 `s[i] >= 'a'` 是對的（比較另有處理），所以症狀只出現在算術上：
      // 大小寫轉換那一族全部靜靜地不動。
      //
      // > **同一個概念有三種表示時，錯的那一種只會在某些運算下現形。**
      return { type: 'char', value: str.charCodeAt(idx) }
    })
}
