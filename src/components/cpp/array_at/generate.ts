/** `cpp:array_at` 的 **generate** 路——從共用檔原封剪過來（批次第三十八批）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:array_at', (node, ctx) => {
      // 🟢 容器是一顆節點（2026-08-26）
      const objs = node.children.obj ?? []
      const name = objs.length > 0 ? generateExpression(objs[0], ctx) : 'arr'
      const indexNodes = node.children.index ?? []
      const idx = indexNodes.length > 0 ? generateExpression(indexNodes[0], ctx) : '0'
      return `${name}[${idx}]`
    })
}
