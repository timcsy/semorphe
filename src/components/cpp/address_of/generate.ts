/** `cpp:address_of` 的 **generate** 路——從共用檔原封剪過來（批次第三十二批：一元運算子族）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:address_of', (node, ctx) => {
      const v = generateExpression((node.children.var ?? [])[0], ctx)
      return `&${v}`
    })
}
