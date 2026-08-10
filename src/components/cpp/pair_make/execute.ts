/** `cpp:pair_make` 的 **execute** 路——從共用檔原封剪過來（批次第六批：lift 是 io.ts 的一個帶真邏輯的分支）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:pair_make', async (node, ctx) => {
      const f = node.children.first?.[0]
      const s = node.children.second?.[0]
      const fv = f ? await ctx.evaluate(f) : { type: 'int' as const, value: 0 }
      const sv = s ? await ctx.evaluate(s) : { type: 'int' as const, value: 0 }
      return { type: 'string' as const, value: `(${fv.value}, ${sv.value})` }
    })
}
