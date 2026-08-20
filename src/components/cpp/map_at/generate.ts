/** `cpp:map_at` 的 **generate** 路——從共用檔原封剪過來（批次第十四批：subscript_expression 的分支）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  // Expression components
    g.set('cpp:map_at', (node, ctx) => {
      const obj = node.properties.obj ?? 'mp'
      const keyNodes = node.children.key ?? []
      const key = keyNodes.length > 0 ? generateExpression(keyNodes[0], ctx) : '0'
      return `${obj}[${key}]`
    })
}
