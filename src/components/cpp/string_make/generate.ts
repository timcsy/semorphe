/** `cpp:string_make` 的 **generate** 路——從共用檔原封剪過來（批次第六批：lift 是 io.ts 的一個帶真邏輯的分支）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:string_make', (node, ctx) => {
      const valueNodes = node.children.value ?? []
      const val = valueNodes.length > 0 ? generateExpression(valueNodes[0], ctx) : '0'
      return `to_string(${val})`
    })
}
