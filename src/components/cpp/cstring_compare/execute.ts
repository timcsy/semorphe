/** `cpp:cstring_compare` 的 **execute** 路——從共用檔原封剪過來（批次第二批：lift 是 io.ts 的一個純資料分支）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:cstring_compare', async (node, ctx) => {
      const s1Nodes = node.children.s1 ?? []
      const s2Nodes = node.children.s2 ?? []
      const s1 = s1Nodes.length > 0 ? String((await ctx.evaluate(s1Nodes[0])).value) : ''
      const s2 = s2Nodes.length > 0 ? String((await ctx.evaluate(s2Nodes[0])).value) : ''
      if (s1 < s2) return { type: 'int', value: -1 }
      if (s1 > s2) return { type: 'int', value: 1 }
      return { type: 'int', value: 0 }
    })
}
