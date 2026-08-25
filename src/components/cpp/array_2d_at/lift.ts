/**
 * `cpp:array_2d_at` 的 **lift** 路——**`subscript_expression` 的一個分支**
 *
 * ⚠️ **判別寫成完全具體的**，不倚賴「排在第幾個」——分支的登錄順序來自
 * `import.meta.glob` 的檔名排序，那不是任何人設計的。
 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'
import { registerAstBranch } from '../../../core/component/lift-branches'

export function registerLift(): void {
  registerAstBranch('subscript_expression', 'cpp/array_2d_at', (node, ctx): SemanticNode | null => {
    // `arr[i][j]`——**外層下標的引數還是下標時是我**
    const arrayNode = node.childForFieldName('argument') ?? node.namedChildren[0]
    if (arrayNode?.type !== 'subscript_expression') return null
    const innerArrayNode = arrayNode.childForFieldName('argument') ?? arrayNode.namedChildren[0]
    const rowIndices = arrayNode.namedChildren.find((c) => c.type === 'subscript_argument_list')
    const rowNode = rowIndices?.namedChildren[0] ?? arrayNode.namedChildren[1]
    const colIndices = node.namedChildren.find((c) => c.type === 'subscript_argument_list')
    const colNode = colIndices?.namedChildren[0] ?? node.namedChildren[1]
    const row = rowNode ? ctx.lift(rowNode) : null
    const col = colNode ? ctx.lift(colNode) : null
    // 🟢 **容器一律 lift**（2026-08-26）——見 `component.json` 的說明。
    const container = innerArrayNode ? ctx.lift(innerArrayNode) : null
    return createNode('cpp:array_2d_at', {}, {
      obj: container ? [container] : [],
      row: row ? [row] : [],
      col: col ? [col] : [],
    })
  })
}
