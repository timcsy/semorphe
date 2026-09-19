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
  registerDeclaratorBranch('cpp/array_2d_declare', (decl, type, ctx): SemanticNode | null => {
    if (decl.type !== 'array_declarator') return null
    const inner = decl.namedChildren[0]
    if (inner?.type !== 'array_declarator') return null
    /**
     * 🔴 **維度是【接點】不是 `.text`**（2026-09-19）——見 `component.json` 的 `_children_why`。
     *
     * ⚠️ **維度可以省略**（`int a[][3] = {…}`），所以接不出來時**不讓開**
     *    ——那一格就是空的，而執行期用初始值的長度補。
     *    這與同族的兩端（接不出來就讓開）**判準相反**，而理由是
     *    C++ 允許省略第一維，但不允許只給一端的範圍。
     */
    const rows = inner.namedChildren[1] ? ctx.lift(inner.namedChildren[1]) : null
    const cols = decl.namedChildren[1] ? ctx.lift(decl.namedChildren[1]) : null
    return createNode('cpp:array_2d_declare', {
      type,
      name: inner.namedChildren[0]?.text ?? 'arr',
    }, {
      ...(rows ? { rows: [rows] } : {}),
      ...(cols ? { cols: [cols] } : {}),
    })
  })
}
