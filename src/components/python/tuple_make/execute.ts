/**
 * `python:tuple_make` 的 **execute** 路。
 *
 * ⚠️ 執行期用與串列同一個值型別（`array`）——**不可變是語言層的約束，
 * 而這個直譯器還沒有那一層**。寫在這裡是為了讓它是一個**已知的簡化**，
 * 不是一個沒有人記得的巧合。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:tuple_make', async (node, ctx) => {
    const items: RuntimeValue[] = []
    for (const it of node.children.items ?? []) items.push(await ctx.evaluate(it))
    return { type: 'array', value: items }
  })
}
