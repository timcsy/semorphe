/**
 * `python:pair_make` 的 **execute** 路——回傳一組「鍵與值」。
 *
 * ⚠️ 它**不是**獨立求值的東西：字典字面那顆會拿走這兩格。
 * 而這裡仍然實作，因為求值的順序（先鍵後值）是 Python 的規則，
 * 寫在父概念裡會讓它與這顆的接點宣告分成兩處。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:pair_make', async (node, ctx) => {
    const k = await ctx.evaluate(node.children.key[0])
    const v = await ctx.evaluate(node.children.value[0])
    return { type: 'array', value: [k, v] }
  })
}
