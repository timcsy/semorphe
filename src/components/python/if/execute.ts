/** `python:if` 的 **execute** 路。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:if', async (node, ctx) => {
    // ⚠️ Python 的 if 【沒有】自己的作用域 —— 裡面指派的名字外面也看得到。
    if (ctx.toBool(await ctx.evaluate(node.children.condition[0]))) {
      await ctx.executeBody(node.children.body ?? [])
    }
  })
}
