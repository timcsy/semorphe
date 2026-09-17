/** `cpp:vector_size` 的 **generate** 路——從共用檔原封剪過來（批次第九批：容器方法資料表）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  // Expression components — return expression string (no indent, no newline)
    g.set('cpp:vector_size', (node, ctx) => {
      // 🔴 接收者是接點——`m[k].f()` 的 `m[k]` 是一棵樹，不是一串文字
      const vector = generateExpression((node.slots.obj ?? [])[0], ctx)
      return `${vector}.size()`
    })
}
