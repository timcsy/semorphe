/** `cpp:cstring_copy_bounded` 的 **generate** 路——從共用檔原封剪過來（批次第六批：lift 是 io.ts 的一個帶真邏輯的分支）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:cstring_copy_bounded', (node, ctx) => {
      const dest = generateExpression((node.slots.dest ?? [])[0], ctx)
      const src = generateExpression((node.slots.src ?? [])[0], ctx)
      const n = generateExpression((node.slots.n ?? [])[0], ctx)
      return `${indent(ctx)}strncpy(${dest}, ${src}, ${n});\n`
    })
}
