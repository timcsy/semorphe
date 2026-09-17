/** `cpp:priority_queue_peek` 的 **generate** 路——從共用檔原封剪過來（批次第十三批：依型別分派的方法表）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:priority_queue_peek', (node, ctx) => {
      // 🔴 接收者是接點——`m[k].f()` 的 `m[k]` 是一棵樹，不是一串文字
      const obj = generateExpression((node.slots.obj ?? [])[0], ctx)
      return `${obj}.top()`
    })
}
