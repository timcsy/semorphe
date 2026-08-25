/** `cpp:array_2d_at` 的 **generate** 路——從共用檔原封剪過來（批次第十四批：subscript_expression 的分支）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:array_2d_at', (node, ctx) => {
      const objs2 = node.children.obj ?? []
      const name = objs2.length > 0 ? generateExpression(objs2[0], ctx) : 'arr'
      const rowNodes = node.children.row ?? []
      const colNodes = node.children.col ?? []
      const row = rowNodes.length > 0 ? generateExpression(rowNodes[0], ctx) : '0'
      const col = colNodes.length > 0 ? generateExpression(colNodes[0], ctx) : '0'
      return `${name}[${row}][${col}]`
    })
}
