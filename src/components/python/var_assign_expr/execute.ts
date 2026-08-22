/**
 * `python:var_assign_expr` 的 **execute** 路——**指派，然後把值交出去**。
 *
 * 🔴 綁在**現在這個作用域**（不是新開一個）：`if (n := len(xs)) > 3:` 之後
 * `n` 在 if 外面仍然看得見，而那正是這個運算子存在的理由。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:var_assign_expr', async (node, ctx) => {
    const name = String(node.properties.obj ?? 'n')
    const src = (node.children.value ?? [])[0]
    if (!src) throw new RuntimeError(RUNTIME_ERRORS.UNRECOGNIZED_CODE, { '%1': ':= 少了值' })
    const v = await ctx.evaluate(src)
    if (ctx.scope.has(name)) ctx.scope.set(name, v)
    else ctx.scope.declare(name, v)
    return v
  })
}
