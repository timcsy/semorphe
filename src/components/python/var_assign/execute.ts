/** `python:var_assign` 的 **execute** 路。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:var_assign', async (node, ctx) => {
    const name = String(node.properties.obj ?? 'x')
    const v = await ctx.evaluate(node.children.value[0])
    // 🔴 **Python 沒有「宣告」這件事**：第一次指派建立它，之後覆寫。
    // ⚠️ 所以【不能】每次都 `declare`——那在迴圈第二圈會 `DUPLICATE_DECLARATION`。
    if (ctx.scope.has(name)) ctx.scope.set(name, v)
    else ctx.scope.declare(name, v)
  })
}
