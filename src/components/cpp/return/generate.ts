/** `cpp:return` 的 **generate** 路——從共用檔原封剪過來（批次第三十五批）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:return', (node, ctx) => {
      const vals = node.children.value ?? []
      if (vals.length > 0) {
        const val = generateExpression(vals[0], ctx)
        return `${indent(ctx)}return ${val};\n`
      }
      return `${indent(ctx)}return;\n`
    })
}
