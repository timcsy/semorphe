/** `cpp:throw` 的 **generate** 路——從共用檔原封剪過來（批次第一批）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:throw', (node, ctx) => {
      const vals = node.children.value ?? []
      if (vals.length > 0) {
        const val = generateExpression(vals[0], ctx)
        return `${indent(ctx)}throw ${val};\n`
      }
      return `${indent(ctx)}throw;\n`
    })
}
