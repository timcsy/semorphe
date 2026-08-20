/** `cpp:try_catch` 的 **execute** 路——從共用檔原封剪過來（批次第三批：lift 是只產一種身分的具名策略）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { BreakSignal, ContinueSignal } from '../../../interpreter/executors/control-flow'
// ⚠️ **訊號類別必須是同一個**——複製一份的話 `instanceof` 會失敗，
// 而失敗的樣子是「throw 沒有被 catch 接住」，不是編譯錯誤。
//
// `languages/cpp/core/executors/control-flow.ts` **自己複製了一份** `ThrownSignal`
// （就寫在一句警告「複製一份的話 instanceof 會失敗」的正下方），
// 而這兩顆剛好都用那一份，所以沒有爆。`switch` 搬進膠囊後那個檔全空了，
// 兩顆一起改指真正的那一份——**順手把那個複本消滅掉**。
import { ThrownSignal } from '../../../interpreter/executors/control-flow'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:try_catch', async (node, ctx) => {
      const tryBody = node.children.try_body ?? []
      const catchBody = node.children.catch_body ?? []
      const catchName = String(node.properties.catch_name ?? 'e')
      try {
        await ctx.executeBody(tryBody)
      } catch (signal) {
        if (signal instanceof BreakSignal || signal instanceof ContinueSignal) throw signal
        if (signal instanceof ThrownSignal) {
          const parentScope = ctx.scope
          ctx.scope = parentScope.createChild()
          // ⚠️ **不能 `String(signal.value)`。** `signal.value` 是 RuntimeValue
          // 物件，字串化之後 `catch (int e) { cout << e; }` 印出 `[object Object]`
          // ——程式跑完、印出東西、而那是一個不存在的值。
          const thrown = signal.value as unknown
          const value =
            thrown !== null && typeof thrown === 'object' && 'type' in (thrown as object)
              ? (thrown as { type: string; value: unknown })
              : { type: 'string', value: String(thrown) }
          ctx.scope.declare(catchName, value as never)
          await ctx.executeBody(catchBody)
          ctx.scope = parentScope
        } else {
          throw signal
        }
      }
    })
}
