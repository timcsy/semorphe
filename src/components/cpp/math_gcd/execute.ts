/** `cpp:math_gcd` 的 **execute** 路——從共用檔原封剪過來（批次第六批：lift 是 io.ts 的一個帶真邏輯的分支）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:math_gcd', async (node, ctx) => {
      const a = node.children.a?.[0]
      const b = node.children.b?.[0]
      const va = a ? ctx.toNumber(await ctx.evaluate(a)) : 0
      const vb = b ? ctx.toNumber(await ctx.evaluate(b)) : 0
      const gcd = (x: number, y: number): number => y === 0 ? x : gcd(y, x % y)
      return { type: 'int' as const, value: gcd(Math.abs(va), Math.abs(vb)) }
    })
}
