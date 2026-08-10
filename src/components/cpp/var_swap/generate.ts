/** `cpp:var_swap` 的 **generate** 路——從共用檔原封剪過來（批次第六批：lift 是 io.ts 的一個帶真邏輯的分支）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:var_swap', (node, ctx) => {
      const a = node.properties.a ?? 'a'
      const b = node.properties.b ?? 'b'
      return `${indent(ctx)}swap(${a}, ${b});\n`
    })
}
