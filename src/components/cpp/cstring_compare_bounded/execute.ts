/** `cpp:cstring_compare_bounded` 的 **execute** 路——從共用檔原封剪過來（批次第六批：lift 是 io.ts 的一個帶真邏輯的分支）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:cstring_compare_bounded', async (node, ctx) => {
      const s1Nodes = node.children.s1 ?? []
      const s2Nodes = node.children.s2 ?? []
      const nNodes = node.children.n ?? []
      const s1 = s1Nodes.length > 0 ? String((await ctx.evaluate(s1Nodes[0])).value) : ''
      const s2 = s2Nodes.length > 0 ? String((await ctx.evaluate(s2Nodes[0])).value) : ''
      const n = nNodes.length > 0 ? ctx.toNumber(await ctx.evaluate(nNodes[0])) : 0
      const sub1 = s1.substring(0, n)
      const sub2 = s2.substring(0, n)
      if (sub1 < sub2) return { type: 'int', value: -1 }
      if (sub1 > sub2) return { type: 'int', value: 1 }
      return { type: 'int', value: 0 }
    })
}
