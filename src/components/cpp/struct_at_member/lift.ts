/**
 * `cpp:struct_at_member` 的 **lift** 路——**`field_expression` 的一個分支**
 *
 * ⚠️ 兩顆的判別**都寫成具體的**（有 `->` ／ 沒有 `->`），不是一個具體、
 * 一個「其餘」。登錄順序來自檔名排序，那不是任何人設計的。
 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'
import { registerAstBranch } from '../../../core/component/lift-branches'

export function registerLift(): void {
  registerAstBranch('field_expression', 'cpp/struct_at_member', (node, _ctx): SemanticNode | null => {
    // `s.member`——**沒有 `->` 時是我**（判別寫成具體的，不是「其餘」）
    if (node.children.find((c) => c.type === '->')) return null
    return createNode('cpp:struct_at_member', {
      obj: node.childForFieldName('argument')?.text ?? '',
      member: node.childForFieldName('field')?.text ?? '',
    })
  })
}
