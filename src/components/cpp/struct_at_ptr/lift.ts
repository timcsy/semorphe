/**
 * `cpp:struct_at_ptr` 的 **lift** 路——**`field_expression` 的一個分支**
 *
 * ⚠️ 兩顆的判別**都寫成具體的**（有 `->` ／ 沒有 `->`），不是一個具體、
 * 一個「其餘」。登錄順序來自檔名排序，那不是任何人設計的。
 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'
import { registerAstBranch } from '../../../core/component/lift-branches'

export function registerLift(): void {
  registerAstBranch('field_expression', 'cpp/struct_at_ptr', (node, ctx): SemanticNode | null => {
    // `p->member`——**有 `->` 運算子時是我**
    if (!node.children.find((c) => c.type === '->')) return null
    /**
     * 🟢 **接收者一律 lift**（2026-09-18）——`copy.begin()->second`、`it->second`
     * 的接收者是一個**運算式**。同族的 `.`（成員存取）2026-08-26 就這樣做了，
     * 而這一條漏掉了：它把接收者 `.text` 抄成字串，於是
     * `scope.get("copy.begin()")` 說「這個變數尚未宣告」。
     */
    const argNode = node.childForFieldName('argument')
    const recv = argNode ? ctx.lift(argNode) : null
    if (!recv) return null
    return createNode('cpp:struct_at_ptr', {
      member: node.childForFieldName('field')?.text ?? '',
    }, { obj: [recv] })
  })
}
