/**
 * `cpp:array_2d_declare` 的 **lift** 路——**宣告子的一個分支**
 *
 * ⚠️ 這種分支比一般的多一個 `type` 參數：`int arr[3][4]` 的型別 `int` 與
 * 宣告子 `arr[3][4]` 在 AST 上是**兄弟節點**，分支看不到父節點。
 *
 * > **一個分支需要的脈絡，如果它自己看不到，就必須由呼叫端給。**
 * > 讓分支自己去爬父節點是另一條會漂移的路——它要假設 AST 的形狀。
 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'
import { registerDeclaratorBranch } from '../../../core/component/lift-branches'

export function registerLift(): void {
  registerDeclaratorBranch('cpp/array_2d_declare', (decl, type, _ctx): SemanticNode | null => {
    if (decl.type !== 'array_declarator') return null
    const inner = decl.namedChildren[0]
    if (inner?.type !== 'array_declarator') return null
    return createNode('cpp:array_2d_declare', {
      type,
      name: inner.namedChildren[0]?.text ?? 'arr',
      rows: inner.namedChildren[1]?.text ?? '0',
      cols: decl.namedChildren[1]?.text ?? '0',
    })
  })
}
