/** `cpp:cast` 的 **generate** 路——從共用檔原封剪過來（批次第二十七批：轉型族）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:cast', (node, ctx) => {
      const targetType = node.properties.target_type ?? 'int'
      const val = generateExpression((node.children.value ?? [])[0], ctx)
      return `(${targetType})${val}`
    })
}
