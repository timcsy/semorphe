/**
 * `python:type_is` 的 **execute** 路——走內建表那一份。
 *
 * 🔴 **不自己算**：「`True` 也算整數」這種規則已經寫在
 * `languages/python/builtins.ts`，而使用者手寫的 `isinstance(...)` 走的也是那一份。
 * **兩份會先後錯。**
 *
 * ⚠️ 型別是一格**下拉**（不是插槽），所以這裡把它包成內建表看得懂的形狀
 * ——那一份讀的是「這個值指到哪個名字」。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
import { withCall } from '../func_def/call'
import { PYTHON_BUILTIN_FUNCTIONS } from '../../../languages/python/builtins'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:type_is', async (node, ctx) => {
    const v = await ctx.evaluate(node.children.obj[0])
    const want: RuntimeValue = {
      type: 'function',
      value: { ref: 'builtin', name: String(node.properties.target_type ?? 'int') },
    }
    return PYTHON_BUILTIN_FUNCTIONS['isinstance']([v, want], withCall(ctx))
  })
}
