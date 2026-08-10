/** `cpp:pointer_assign` 的 **generate** 路——從共用檔原封剪過來（批次第十批：assignment_expression 的分支）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:pointer_assign', (node, ctx) => {
      const ptrName = node.properties.obj ?? 'ptr'
      const vals = node.children.value ?? []
      if (vals.length > 0) {
        const val = generateExpression(vals[0], ctx)
        return `${indent(ctx)}*${ptrName} = ${val};\n`
      }
      return `${indent(ctx)}*${ptrName} = 0;\n`
    })
}
