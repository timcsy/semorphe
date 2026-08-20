/** `python:if_else` 的 **execute** 路。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:if_else', async (node, ctx) => {
    const cond = ctx.toBool(await ctx.evaluate(node.children.condition[0]))
    await ctx.executeBody((cond ? node.children.body : node.children.else_body) ?? [])
  })
}
