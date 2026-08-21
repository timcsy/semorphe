/**
 * `python:ternary` 的 **execute** 路。
 *
 * 🔴 **只算被選中的那一邊**——兩邊都算會讓 `x[0] if x else 0` 在空串列時爆掉，
 * 而那正是這個寫法最常見的用途。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:ternary', async (node, ctx) => {
    const cond = ctx.toBool(await ctx.evaluate(node.children.condition[0]))
    const picked = cond ? node.children.then_value : node.children.else_value
    return ctx.evaluate(picked[0])
  })
}
