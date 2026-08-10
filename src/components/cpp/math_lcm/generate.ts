/** `cpp:math_lcm` 的 **generate** 路——從共用檔原封剪過來（批次第六批：lift 是 io.ts 的一個帶真邏輯的分支）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:math_lcm', (node, ctx) => {
      const a = generateExpression((node.children.a ?? [])[0], ctx)
      const b = generateExpression((node.children.b ?? [])[0], ctx)
      return `lcm(${a}, ${b})`
    })
}
