/** `python:return` 的 **execute** 路。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:return', async (node, ctx) => {
    const kid = (node.children.value ?? [])[0]
    // 沒有值的 return 回 void —— 那正是 Python 的 `None`。
    return kid ? await ctx.evaluate(kid) : { type: 'void' as const, value: null }
  })
}
