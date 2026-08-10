/** `cpp:try_catch` 的 **execute** 路——從共用檔原封剪過來（批次第三批：lift 是只產一種身分的具名策略）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import { BreakSignal, ContinueSignal } from '../../../interpreter/executors/control-flow'
import { ThrownSignal } from '../../../languages/cpp/core/executors/control-flow'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
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
          const 丟出的 = signal.value as unknown
          const 值 =
            丟出的 !== null && typeof 丟出的 === 'object' && 'type' in (丟出的 as object)
              ? (丟出的 as { type: string; value: unknown })
              : { type: 'string', value: String(丟出的) }
          ctx.scope.declare(catchName, 值 as never)
          await ctx.executeBody(catchBody)
          ctx.scope = parentScope
        } else {
          throw signal
        }
      }
    })
}
