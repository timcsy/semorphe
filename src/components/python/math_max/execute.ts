/**
 * `python:math_max` 的 **execute** 路——走內建表那一份。
 *
 * 🔴 **不自己算**：`max` 的規則（吃序列還是多引數、空的時候怎麼辦）
 * 已經寫在 `languages/python/builtins.ts`，而使用者手寫的 `max(...)`
 * 走的也是那一份。**兩份會先後錯。**
 *
 * ## 🔴 使用者自己 `def max(x)` 時要讓路
 *
 * 判別在 **lift 期**（這顆元件認走了那個名字），而「有沒有被蓋掉」是
 * **執行期**才知道的事——所以讓路發生在這裡，不是在 lift。
 *
 * ⚠️ 不讓路的症狀：`def max(x): return 99` 之後 `max(a)` 仍然算內建的
 * ——**而積木、來回轉換、型別檢查全部正常**。
 *
 * > **一個在 lift 期做的判別，答不出一個在執行期才成立的問題。**
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
import { PYTHON_BUILTIN_FUNCTIONS } from '../../../languages/python/builtins'
import { callWith, withCall } from '../func_def/call'

import { evalPythonArgs } from '../../../languages/python/args'
export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:math_max', async (node, ctx) => {
    // 使用者自己定義的同名函式優先——Python 允許蓋掉內建的
    const userDefined = ctx.functions.get('max')
    const args: RuntimeValue[] = []
    args.push(...(await evalPythonArgs(node.children.values ?? [], ctx)))
    if (userDefined) return callWith(userDefined, args, ctx, 'max')
    return PYTHON_BUILTIN_FUNCTIONS['max'](args, withCall(ctx))
  })
}
