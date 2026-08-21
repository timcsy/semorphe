/**
 * `python:string_lower` 的 **execute** 路——走內建表那一份。
 *
 * 🔴 **不自己算**：`lower` 的規則已經寫在 `languages/python/builtins.ts`，
 * 而使用者手寫的 `x.lower(...)` 走的也是那一份。**兩份會先後錯。**
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
import { withCall } from '../func_def/call'
import { PYTHON_BUILTIN_METHODS } from '../../../languages/python/builtins'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:string_lower', async (node, ctx) => {
    const self = await ctx.evaluate(node.children.obj[0])
    const args: RuntimeValue[] = []
    
    return PYTHON_BUILTIN_METHODS['lower'](self, args, withCall(ctx))
  })
}
