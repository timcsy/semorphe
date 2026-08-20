/** `cpp:math_pow` 的 **execute** 路——從 `std/cmath/executors.ts` 原封搬過來。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:math_pow', async (node, ctx) => {
    const base = await ctx.evaluate((node.children.base ?? [])[0])
    const exponent = await ctx.evaluate((node.children.exponent ?? [])[0])
    return { type: 'double', value: Math.pow(ctx.toNumber(base), ctx.toNumber(exponent)) }
  })
}
