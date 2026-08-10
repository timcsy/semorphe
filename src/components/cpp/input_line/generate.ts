/** `cpp:input_line` 的 **generate** 路——從共用檔原封剪過來（批次第六批：lift 是 io.ts 的一個帶真邏輯的分支）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:input_line', (node, ctx) => {
      const name = node.properties.name ?? 'str'
      return `${indent(ctx)}getline(cin, ${name});\n`
    })
}
