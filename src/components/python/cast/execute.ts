/**
 * `python:cast` 的 **execute** 路——走內建表那一份。
 *
 * 🔴 **不自己算**：`int("12")` 要不要剖析、`bool([])` 為什麼是假
 * （容器看空不空，不是轉成數字）都寫在 `languages/python/builtins.ts`，
 * 而使用者手寫的 `int(...)` 走的也是那一份。**兩份會先後錯。**
 *
 * ## 🔴 使用者自己 `def int(x)` 時要讓路
 *
 * 判別在 **lift 期**（這顆元件認走了那個名字），而「有沒有被蓋掉」是
 * **執行期**才知道的事——所以讓路發生在這裡，不是在 lift。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
import { callWith, withCall } from '../func_def/call'
import { PYTHON_BUILTIN_FUNCTIONS } from '../../../languages/python/builtins'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:cast', async (node, ctx) => {
    const to = String(node.properties.target_type ?? 'int')
    const args: RuntimeValue[] = []
    for (const a of node.children.value ?? []) args.push(await ctx.evaluate(a))
    const userDefined = ctx.functions.get(to)
    if (userDefined) return callWith(userDefined, args, ctx, to)
    return PYTHON_BUILTIN_FUNCTIONS[to](args, withCall(ctx))
  })
}
