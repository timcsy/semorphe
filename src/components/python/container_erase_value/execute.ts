/**
 * `python:container_erase_value` 的 **execute** 路——走內建表那一份。
 *
 * 🔴 **不自己算，也不自己挑**：先問使用者定義的類別方法，再回內建表。
 * `remove` 的規則已經寫在 `languages/python/builtins.ts`，
 * 而使用者手寫的 `x.remove(...)` 走的也是那一份。**兩份會先後錯。**
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
// 🔴 **使用者自己的類別可能也有這個方法**（`c.add(3)`）——`callMethod` 先問
//    使用者定義的，再回內建表。少了這一步的症狀是一個完全正確的 Python 程式
//    在執行期收到「串列沒有 add」這種與它無關的錯誤。
import { callMethod } from '../method_call/dispatch'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:container_erase_value', async (node, ctx) => {
    const self = await ctx.evaluate(node.children.obj[0])
    const args: RuntimeValue[] = []
    for (const k of ["value"]) {
      const n = (node.children as Record<string, unknown[]>)[k]?.[0]
      if (n) args.push(await ctx.evaluate(n as never))
    }
    return callMethod(self, 'remove', args, ctx)
  })
}
