/**
 * `python:container_size` 的 **execute** 路——走內建表那一份。
 *
 * 🔴 **不自己算**：`len` 的規則（吃序列還是多引數、空的時候怎麼辦）
 * 已經寫在 `languages/python/builtins.ts`，而使用者手寫的 `len(...)`
 * 走的也是那一份。**兩份會先後錯。**
 *
 * ## 🔴 使用者自己 `def len(x)` 時要讓路
 *
 * 判別在 **lift 期**（這顆元件認走了那個名字），而「有沒有被蓋掉」是
 * **執行期**才知道的事——所以讓路發生在這裡，不是在 lift。
 *
 * ⚠️ 不讓路的症狀：`def len(x): return 99` 之後 `len(a)` 仍然算內建的
 * ——**而積木、來回轉換、型別檢查全部正常**。
 *
 * > **一個在 lift 期做的判別，答不出一個在執行期才成立的問題。**
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
import { PYTHON_BUILTIN_FUNCTIONS } from '../../../languages/python/builtins'
import { callWith } from '../func_def/call'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:container_size', async (node, ctx) => {
    // 使用者自己定義的同名函式優先——Python 允許蓋掉內建的
    const userDefined = ctx.functions.get('len')
    const args: RuntimeValue[] = []
    for (const a of node.children.obj ?? []) args.push(await ctx.evaluate(a))
    if (userDefined) return callWith(userDefined, args, ctx, 'len')
    return PYTHON_BUILTIN_FUNCTIONS['len'](args, ctx)
  })
}
