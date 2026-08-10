/** `cpp:math_max` 的 **execute** 路——從共用檔原封剪過來（批次第六批：lift 是 io.ts 的一個帶真邏輯的分支）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:math_max', async (node, ctx) => {
      const a = node.children.a?.[0]
      const b = node.children.b?.[0]
      const va = a ? await ctx.evaluate(a) : { type: 'int' as const, value: 0 }
      const vb = b ? await ctx.evaluate(b) : { type: 'int' as const, value: 0 }
      const na = ctx.toNumber(va)
      const nb = ctx.toNumber(vb)
      return na >= nb ? va : vb
    })
}
