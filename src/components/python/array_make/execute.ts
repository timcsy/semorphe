/** `python:array_make` 的 **execute** 路——求出每一格，組成一個陣列值。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:array_make', async (node, ctx) => {
    const items: RuntimeValue[] = []
    for (const it of node.children.items ?? []) items.push(await ctx.evaluate(it))
    return { type: 'array', value: items }
  })
}
