/** `cpp:member_static` 的 **generate** 路——從共用檔原封剪過來（批次第三十批）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:member_static', (node, ctx) => {
      const type = node.properties.type ?? 'int'
      const name = node.properties.name ?? 'count'
      return `${indent(ctx)}static ${type} ${name};\n`
    })
}
