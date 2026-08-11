/** `cpp:string_at` 的 **generate** 路——從共用檔原封剪過來（批次第二十四批：單一建立點 → 建構子）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:string_at', (node, ctx) => {
      const obj = node.properties.obj ?? 'str'
      const indexNodes = node.children.index ?? []
      const index = indexNodes.length > 0 ? generateExpression(indexNodes[0], ctx) : '0'
      return `${obj}[${index}]`
    })
}
