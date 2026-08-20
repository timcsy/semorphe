/** `python:logic_not` 的 **execute** 路。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:logic_not', async (node, ctx) => {
    const v = await ctx.evaluate(node.children.value[0])
    // `not` 是唯一【一定】回布林的邏輯運算 —— 與 `and`/`or` 不同。
    return { type: 'bool', value: !ctx.toBool(v) }
  })
}
