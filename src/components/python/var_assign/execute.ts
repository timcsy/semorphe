/** `python:var_assign` 的 **execute** 路。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:var_assign', async (node, ctx) => {
    const name = String(node.properties.obj ?? 'x')
    const v = await ctx.evaluate(node.children.value[0])
    // Python 沒有宣告 —— 第一次指派就建立它，之後的指派覆寫。
    // 所以這裡【不能】先查它存不存在再決定要 declare 還是 set。
    ctx.scope.declare(name, v)
  })
}
