/** `cpp:cstring_append` 的 **generate** 路——從共用檔原封剪過來（批次第二批：lift 是 io.ts 的一個純資料分支）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:cstring_append', (node, ctx) => {
      const dest = generateExpression((node.children.dest ?? [])[0], ctx)
      const src = generateExpression((node.children.src ?? [])[0], ctx)
      return `${indent(ctx)}strcat(${dest}, ${src});\n`
    })
}
