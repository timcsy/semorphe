/** `cpp:cstring_compare` 的 **generate** 路——從共用檔原封剪過來（批次第二批：lift 是 io.ts 的一個純資料分支）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:cstring_compare', (node, ctx) => {
      const s1 = generateExpression((node.children.s1 ?? [])[0], ctx)
      const s2 = generateExpression((node.children.s2 ?? [])[0], ctx)
      return `strcmp(${s1}, ${s2})`
    })
}
