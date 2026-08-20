/** `cpp:string_declare` 的 **execute** 路——從共用檔原封剪過來（批次第十六批：型別名資料表）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

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
      const init = node.children.initializer ?? node.children.value ?? []
      if (init.length > 0) {
        const v = await ctx.evaluate(init[0])
        ctx.scope.declare(name, { type: 'string', value: String(v.value) })
        return
      }
      ctx.scope.declare(name, { type: 'string', value: '' })
    })
}
