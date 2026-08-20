/** `python:negate` 的 **execute** 路。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:negate', async (node, ctx) => {
    const v = await ctx.evaluate(node.children.value[0])
    return { type: 'double', value: -ctx.toNumber(v) }
  })
}
