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
  registerAstBranch('field_expression', 'cpp/struct_at_ptr', (node, _ctx): SemanticNode | null => {
    // `p->member`——**有 `->` 運算子時是我**
    if (!node.children.find((c) => c.type === '->')) return null
    return createNode('cpp:struct_at_ptr', {
      obj: node.childForFieldName('argument')?.text ?? '',
      member: node.childForFieldName('field')?.text ?? '',
    })
  })
}
