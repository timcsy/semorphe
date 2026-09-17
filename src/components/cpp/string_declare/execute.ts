/** `cpp:string_declare` 的 **execute** 路——從共用檔原封剪過來（批次第十六批：型別名資料表）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { valueToString } from '../../../interpreter/types'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:string_declare', async (node, ctx) => {
      const name = String(node.properties.name ?? 'str')
      // ⚠️ **初始值原本被完全忽略**——`string s = "abc";` 之後 `s` 是 `""`。
      //
      // 於是 `s.length()` 回 0、`s.substr(0,3)` 回空字串、`cout << s` 印不出
      // 東西——而**沒有任何錯誤訊息**。每一個用到字串初始值的程式都安靜地錯，
      // 而那些測試被停用時標成 `[UNVERIFIED]`（連理由都不知道）。
      //
      // 辨識器把初始值放在 `initializer`（與 `var_declare` 同名）。
      const init = node.slots.initializer ?? node.slots.value ?? []
      if (init.length > 0) {
        const v = await ctx.evaluate(init[0])
        /**
         * 🔴 **`String(v.value)` 對「一串字元格子」給的是 `[object Object],…`**（2026-09-17）。
         *
         * `const char* w[2] = {"ab","cd"}; string x(w[0]);` ——`w[0]` 在執行期
         * 是一串字元格子（C 字串就是那個形狀），而這裡把那個陣列直接丟給 `String()`。
         * ⚠️ 症狀不在建立的那一行：`cout << w[0]` 是對的（印出那一路認得字元陣列），
         * 錯的只有「把它裝進一個字串變數」這一步。
         *
         * > **同一個值有兩個讀法，而只有其中一個知道它是一串字元
         * > ——那個差別會等到第一個用另一個讀法的人才出現。**
         *
         * 🟢 `valueToString` 就是印出那一路用的那一份，改用它。
         */
        ctx.scope.declare(name, { type: 'string', value: valueToString(v) })
        return
      }
      ctx.scope.declare(name, { type: 'string', value: '' })
    })
}
