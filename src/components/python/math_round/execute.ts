/**
 * `python:math_round` 的 **execute** 路——走內建表那一份。
 *
 * 🔴 **不自己算**：規則已經寫在 `languages/python/builtins.ts`，
 * 而使用者手寫的 `round(...)` 走的也是那一份。**兩份會先後錯。**
 *
 * ## 🔴 使用者自己 `def round(x)` 時要讓路
 *
 * 判別在 **lift 期**（這顆元件認走了那個名字），而「有沒有被蓋掉」是
 * **執行期**才知道的事——所以讓路發生在這裡，不是在 lift。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
import { callWith, withCall } from '../func_def/call'
import { PYTHON_BUILTIN_FUNCTIONS } from '../../../languages/python/builtins'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:math_round', async (node, ctx) => {
    const args: RuntimeValue[] = []
    for (const x of node.children.value ?? []) args.push(await ctx.evaluate(x))
    for (const x of node.children.digits ?? []) args.push(await ctx.evaluate(x))
    const userDefined = ctx.functions.get('round')
    if (userDefined) return callWith(userDefined, args, ctx, 'round')
    return PYTHON_BUILTIN_FUNCTIONS['round'](args, withCall(ctx))
  })
}
