/** `cpp:memory_copy` 的 **generate** 路——從共用檔原封剪過來（批次第六批：lift 是 io.ts 的一個帶真邏輯的分支）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:memory_copy', (node, ctx) => {
      const dest = generateExpression((node.children.dest ?? [])[0], ctx)
      const src = generateExpression((node.children.src ?? [])[0], ctx)
      const size = generateExpression((node.children.size ?? [])[0], ctx)
      return `${indent(ctx)}memcpy(${dest}, ${src}, ${size});\n`
    })
}
