/** `cpp:method_virtual_pure` 的 **generate** 路——從共用檔原封剪過來（批次第二十六批：OOP 方法族）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent } from '../../../core/projection/code-generator'
import { formatParams } from '../../../languages/cpp/core/generators/statements'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:method_virtual_pure', (node, ctx) => {
      const returnType = node.properties.return_type ?? 'void'
      const name = node.properties.name ?? 'method'
      const paramChildren = node.children.params ?? []
      const paramStr = formatParams(paramChildren)
      return `${indent(ctx)}virtual ${returnType} ${name}(${paramStr}) = 0;\n`
    })
}
