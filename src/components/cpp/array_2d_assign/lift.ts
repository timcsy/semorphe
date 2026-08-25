/**
 * `cpp:array_2d_assign` 的 **lift** 路——**`assignment_expression` 的一個分支**
 *
 * 原本是 `core/lifters/declarations.ts` 一個 if 鏈裡的一段。那個 if 鏈
 * **不是路由，是六顆元件各自的判別**——「左邊長成這樣時是我」是元件的知識。
 *
 * ⚠️ **判別寫成完全具體的**，不倚賴「排在第幾個」——分支的登錄順序來自
 * `import.meta.glob` 的檔名排序，**那不是任何人設計的**。
 * 這個專案已經被「後註冊的贏」咬過三次。
 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'
import { registerAstBranch } from '../../../core/component/lift-branches'

export function registerLift(): void {
  registerAstBranch('assignment_expression', 'cpp/array_2d_assign', (node, ctx): SemanticNode | null => {
    // `arr[i][j] = v`——**下標裡面還是下標時是我**
    const op = node.children.find((c) => !c.isNamed)?.text ?? '='
    const left = node.childForFieldName('left')
    if (op !== '=' || left?.type !== 'subscript_expression') return null
    const innerNode = left.childForFieldName('argument') ?? left.namedChildren[0]
    if (innerNode?.type !== 'subscript_expression') return null
    const right = node.childForFieldName('right')
    const value = right ? ctx.lift(right) : null
    const arrayNode = innerNode.childForFieldName('argument') ?? innerNode.namedChildren[0]
    // 🔴 **只有「兩層下標一個名字」時才是我**（2026-08-26，第七十三條抓到）。
    //
    // `obj.arr[i][j] = 1` 的容器是一個成員存取，而這顆的 `obj` 是一個**原子**。
    // 回 `null` 之後路由器會落到 `cpp:var_assign（target = cpp:array_2d_at）`。
    //
    // > **一個複合元件的存在條件，是它的每一格都真的裝得下自己那一格。**
    if (arrayNode?.type !== 'identifier') return null
    const rowIndices = innerNode.namedChildren.find((c) => c.type === 'subscript_argument_list')
    const rowNode = rowIndices?.namedChildren[0] ?? innerNode.namedChildren[1]
    const colIndices = left.namedChildren.find((c) => c.type === 'subscript_argument_list')
    const colNode = colIndices?.namedChildren[0] ?? left.namedChildren[1]
    const row = rowNode ? ctx.lift(rowNode) : null
    const col = colNode ? ctx.lift(colNode) : null
    return createNode('cpp:array_2d_assign', { obj: arrayNode?.text ?? 'arr' }, {
      row: row ? [row] : [],
      col: col ? [col] : [],
      value: value ? [value] : [],
    })
  })
}
