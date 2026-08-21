/**
 * **一個方法名該落到誰身上**——使用者的類別優先，然後才是內建表。
 *
 * 🔴 **五顆專屬的方法元件也要走這裡**（`.strip`／`.replace`／`.join`／
 * `.get`／`.items`）：它們在 **lift 期**就認走了那個名字，而
 * 「使用者自己的類別有沒有同名的方法」是**執行期**才知道的事。
 *
 * ```python
 * class Bag:
 *     def get(self, k):
 *         return 99
 * print(Bag().get("x"))     # ← 少了這一段會走到字典的 get 上
 * ```
 *
 * > **一個在 lift 期做的判別，答不出一個在執行期才成立的問題。**
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'
import { PYTHON_BUILTIN_METHODS } from '../../../languages/python/builtins'
import { callWith, withCall } from '../func_def/call'

export async function callMethod(
  self: RuntimeValue,
  method: string,
  args: RuntimeValue[],
  ctx: Parameters<ComponentExecutor>[1],
): Promise<RuntimeValue> {
  // 使用者定義的類別的方法：`d.bark()` —— 登記成 `類別.方法`
  if (self.type === 'object' && self.structName) {
    const m = ctx.functions.get(`${self.structName}.${method}`)
    if (m) return callWith(m, [self, ...args], ctx, method)
  }
  const builtin = PYTHON_BUILTIN_METHODS[method]
  if (builtin) return builtin(self, args, withCall(ctx))
  // 查不到就出聲——靜默回 None 會讓錯誤帶到下一步去算。
  throw new RuntimeError(RUNTIME_ERRORS.UNDEFINED_FUNCTION, { '%1': `.${method}()` })
}
