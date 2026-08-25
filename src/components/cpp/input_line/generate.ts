/** `cpp:input_line` 的 **generate** 路——從共用檔原封剪過來（批次第六批：lift 是 io.ts 的一個帶真邏輯的分支）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:input_line', (node, ctx) => {
      // 🟢 讀進去的那一格是一顆節點（2026-08-25）
      const targets = node.children.target ?? []
      const target = targets.length > 0 ? generateExpression(targets[0], ctx) : 'str'
      return `${indent(ctx)}getline(cin, ${target});\n`
    })
}
