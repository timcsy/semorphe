/** `cpp:pair_make` 的 **generate** 路——從共用檔原封剪過來（批次第六批：lift 是 io.ts 的一個帶真邏輯的分支）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:pair_make', (node, ctx) => {
      const first = generateExpression((node.children.first ?? [])[0], ctx)
      const second = generateExpression((node.children.second ?? [])[0], ctx)
      return `make_pair(${first}, ${second})`
    })
}
