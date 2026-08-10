/** `cpp:math_abs` 的 **generate** 路——從共用檔原封剪過來（批次第二批：lift 是 io.ts 的一個純資料分支）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:math_abs', (node, ctx) => {
      const value = generateExpression((node.children.value ?? [])[0], ctx)
      return `abs(${value})`
    })
}
