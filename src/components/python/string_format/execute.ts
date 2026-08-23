/**
 * `python:string_format` 的 **execute** 路——走內建表那一份。
 *
 * 🔴 **不自己算，也不自己挑**：先問使用者定義的類別方法，再回內建表。
 * `{0}`／`{n}`／`{:>5}` 的規則已經寫在
 * `languages/python/builtins.ts`，而使用者手寫的 `.format(...)` 走的也是那一份。
 * **兩份會先後錯。**
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
// 🔴 **使用者自己的類別可能也有這個方法**（`c.add(3)`）——`callMethod` 先問
//    使用者定義的，再回內建表。少了這一步的症狀是一個完全正確的 Python 程式
//    在執行期收到「串列沒有 add」這種與它無關的錯誤。
import { callMethod } from '../method_call/dispatch'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:string_format', async (node, ctx) => {
    const self = await ctx.evaluate(node.children.obj[0])
    const args: RuntimeValue[] = []
    for (const a of node.children.args ?? []) args.push(await ctx.evaluate(a))
    return callMethod(self, 'format', args, ctx)
  })
}
