/** `cpp:enum` 的 **generate** 路——從共用檔原封剪過來（批次第三批：lift 是只產一種身分的具名策略）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:enum', (node, ctx) => {
      const name = node.properties.name ?? 'MyEnum'
      const values = node.properties.values ?? ''
      return `${indent(ctx)}enum ${name} { ${values} };\n`
    })
}
