/**
 * `cpp:loop_count` 的 **execute** 路——從共用檔原封剪過來（批次第三十七批）。
 *
 * ## 🔴 `for (int i{}; …)` 的起始值曾經是 1（2026-09-20，第 209 刀）
 *
 * `int i{}` 是**值初始化**——對一個數就是 0。而這裡的 `from` 拿到的是
 * 一顆空的 `cpp:initializer_list`，求值之後是 `{ type: 'array', value: [] }`，
 * 而 `toNumber` 對**任何** array 回 **1**。
 *
 * ⚠️ **那一行不能改**：它的註解逐字寫著「一塊存在的儲存體不是空指標」
 *——`new T` 配出來的節點型別就是 `array`，而 `while (p != NULL)` 靠它。
 * 改掉的話整條 Linked List 的走訪一圈都不跑。
 *
 * > **一個共用的轉換，它對「空」的答案是為【另一個呼叫端】定的。**
 *
 * 症狀是**迴圈少跑一次**（`0..n-1` 變成 `1..n-1`），而語料
 * `AP325/2/2_8_loop` 與 `2_8_re` 因此各少印最後一項——
 * 落在報表的「我們少了尾巴（多半是測資餵不夠）」那一欄。
 *
 * 🟢 而 `int i{};` 在**語句位置**一直是對的（`cpp:var_declare` 處理了它）
 * ——又是「一族裡只有一個成員沒處理，而兄弟的綠替它背書」。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
import { BreakSignal, ContinueSignal } from '../../../interpreter/executors/control-flow'

/**
 * 起始值要一個**數**。
 *
 * 🟢 空的 `{}`（值初始化）在這裡是 **0**，而不是 `toNumber` 那條為指標定的 1。
 * ⚠️ 判的是**值的形狀**（空的聚合）而不是元件身分——`{}` 不只從
 * `cpp:initializer_list` 來。
 *
 * ⚠️ **只給 `from`，不給 `to`**：第一版兩邊都套了，而**上界那一邊
 * 沒有任何合法的 C++ 寫法觸發得到**（`i < {}` 不是合法的運算式），
 * 於是那是一個沒有測試、也不可能有測試的分支。
 *
 * > **一個沒有人讀的宣告，與一個寫錯的宣告長得一模一樣。**
 */
function startValue(v: RuntimeValue, toNumber: (x: RuntimeValue) => number): number {
  if (v.type === 'array' && Array.isArray(v.value) && v.value.length === 0) return 0
  return toNumber(v)
}

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:loop_count', async (node, ctx) => {
      const varName = String(node.properties.var_name)
      const from = startValue(await ctx.evaluate(node.slots.from[0]), (x) => ctx.toNumber(x))
      const to = ctx.toNumber(await ctx.evaluate(node.slots.to[0]))
      const body = node.slots.body ?? []
      const parentScope = ctx.scope
      const inclusive = node.properties.inclusive === 'TRUE'

      for (let i = from; inclusive ? i <= to : i < to; i++) {
        ctx.scope = parentScope.createChild()
        ctx.scope.declare(varName, { type: 'int', value: i })
        try {
          await ctx.executeBody(body)
        } catch (signal) {
          if (signal instanceof BreakSignal) break
          if (signal instanceof ContinueSignal) continue
          await ctx.exitScope(ctx.scope, parentScope)
          throw signal
        }
      }
      await ctx.exitScope(ctx.scope, parentScope)
    })
}
