/** `cpp:malloc` 的 **generate** 路——從共用檔原封剪過來（批次第三十四批）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:malloc', (node, ctx) => {
      const type = node.properties.type ?? 'int*'
      const sizeNodes = node.children.size ?? []
      const size = sizeNodes.length > 0 ? generateExpression(sizeNodes[0], ctx) : '1'
      // If sizeof_type is explicitly set (from block), use structured formula
      if (node.properties.sizeof_type) {
        return `(${type})malloc(${size} * sizeof(${node.properties.sizeof_type}))`
      }
      // From lifter: size child is the full malloc argument expression
      return `(${type})malloc(${size})`
    })
}
