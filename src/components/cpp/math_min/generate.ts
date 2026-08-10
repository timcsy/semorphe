/** `cpp:math_min` 的 **generate** 路——從共用檔原封剪過來（批次第六批：lift 是 io.ts 的一個帶真邏輯的分支）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:math_min', (node, ctx) => {
      const aNodes = node.children.a ?? []
      const bNodes = node.children.b ?? []
      const a = aNodes.length > 0 ? generateExpression(aNodes[0], ctx) : '0'
      const b = bNodes.length > 0 ? generateExpression(bNodes[0], ctx) : '0'
      return `min(${a}, ${b})`
    })
}
