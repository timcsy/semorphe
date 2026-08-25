/** `cpp:struct_at_member` 的 **generate** 路——從共用檔原封剪過來（批次第十五批：field_expression 的分支）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:struct_at_member', (node, ctx) => {
      // 🟢 接收者是一顆節點（2026-08-26）
      const recvs = node.children.obj ?? []
      const obj = recvs.length > 0 ? generateExpression(recvs[0], ctx) : 'obj'
      const member = node.properties.member ?? 'field'
      return `${obj}.${member}`
    })
}
