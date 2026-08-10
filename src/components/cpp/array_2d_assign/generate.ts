/** `cpp:array_2d_assign` 的 **generate** 路——從共用檔原封剪過來（批次第十批：assignment_expression 的分支）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:array_2d_assign', (node, ctx) => {
      const name = node.properties.obj ?? 'arr'
      const rowNodes = node.children.row ?? []
      const colNodes = node.children.col ?? []
      const vals = node.children.value ?? []
      const row = rowNodes.length > 0 ? generateExpression(rowNodes[0], ctx) : '0'
      const col = colNodes.length > 0 ? generateExpression(colNodes[0], ctx) : '0'
      const val = vals.length > 0 ? generateExpression(vals[0], ctx) : '0'
      return `${indent(ctx)}${name}[${row}][${col}] = ${val};\n`
    })
}
