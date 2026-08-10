/** `cpp:range_fill_sequence` 的 **generate** 路——從共用檔原封剪過來（批次第六批：lift 是 io.ts 的一個帶真邏輯的分支）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:range_fill_sequence', (node, ctx) => {
      const begin = (node.properties.begin as string) ?? 'v.begin()'
      const end = (node.properties.end as string) ?? 'v.end()'
      const value = generateExpression((node.children.value ?? [])[0], ctx)
      return `${indent(ctx)}iota(${begin}, ${end}, ${value});\n`
    })
}
