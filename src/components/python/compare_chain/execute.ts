/**
 * `python:compare_chain` 的 **execute** 路——`0 < x < 10`。
 *
 * 🔴 **中間那一格只求值一次**，那正是串接與 `a < b and b < c` 的差別：
 * `0 < f() < 10` 在 Python 只呼叫 `f()` 一次。
 *
 * 🔴 **而它會短路**：前半不成立就不算後半。
 *
 * ⚠️ 比較的語義（數字家族互比、型別不同就不等、序對逐格比…）住在
 * `languages/python/compare.ts`——**這裡不重寫一份**。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { comparePython } from '../../../languages/python/compare'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:compare_chain', async (node, ctx) => {
    const a = await ctx.evaluate(node.children.left[0])
    const b = await ctx.evaluate(node.children.middle[0])
    const first = comparePython(String(node.properties.operator ?? '<'), a, b, ctx)
    if (!first) return { type: 'bool', value: false }
    const c = await ctx.evaluate(node.children.right[0])
    return { type: 'bool', value: comparePython(String(node.properties.operator2 ?? '<'), b, c, ctx) }
  })
}
