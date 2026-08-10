/** `cpp:cstring_compare_bounded` 的 **generate** 路——從共用檔原封剪過來（批次第六批：lift 是 io.ts 的一個帶真邏輯的分支）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:cstring_compare_bounded', (node, ctx) => {
      const s1 = generateExpression((node.children.s1 ?? [])[0], ctx)
      const s2 = generateExpression((node.children.s2 ?? [])[0], ctx)
      const n = generateExpression((node.children.n ?? [])[0], ctx)
      return `strncmp(${s1}, ${s2}, ${n})`
    })
}
