/**
 * `python:negate` 的 **execute** 路。
 *
 * ⚠️ **整數取負還是整數**。第一版一律回 `double`，於是 `-7 % 3` 印成 `2.0`
 * ——而那條算術規則本身是對的，錯的是**它拿到的運算元已經被轉成小數了**。
 *
 * > **一個型別在鏈上的任何一節被放寬，後面每一節都救不回來。**
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:negate', async (node, ctx) => {
    const v = await ctx.evaluate(node.children.value[0])
    const isInt = v.type === 'int' || v.type === 'char'
    return { type: isInt ? ('int' as const) : ('double' as const), value: -ctx.toNumber(v) }
  })
}
