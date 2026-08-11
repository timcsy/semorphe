/** `cpp:array_assign` 的 **generate** 路——從共用檔原封剪過來（批次第三十七批）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:array_assign', (node, ctx) => {
      const name = node.properties.obj ?? 'arr'
      const indexNodes = node.children.index ?? []
      const idx = indexNodes.length > 0 ? generateExpression(indexNodes[0], ctx) : '0'
      const vals = node.children.value ?? []
      const val = vals.length > 0 ? generateExpression(vals[0], ctx) : '0'
      return `${indent(ctx)}${name}[${idx}] = ${val};\n`
    })
}
