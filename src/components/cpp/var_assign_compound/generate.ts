/** `cpp:var_assign_compound` 的 **generate** 路——從共用檔原封剪過來（批次第三十四批）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:var_assign_compound', (node, ctx) => {
      const name = node.properties.name ?? 'x'
      const op = node.properties.operator ?? '+='
      const vals = node.children.value ?? []
      const val = vals.length > 0 ? generateExpression(vals[0], ctx) : '0'
      // Array element compound assign: arr[i] += value
      const indexNodes = node.children.index ?? []
      const target = indexNodes.length > 0
        ? `${name}[${generateExpression(indexNodes[0], ctx)}]`
        : `${name}`
      const expr = `${target} ${op} ${val}`
      if (ctx.isExpression) return expr
      return `${indent(ctx)}${expr};\n`
    })
}
