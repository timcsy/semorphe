/** `cpp:typedef` 的 **generate** 路——從共用檔原封剪過來（批次第三批：lift 是只產一種身分的具名策略）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:typedef', (node, ctx) => {
      const origType = node.properties.orig_type ?? 'int'
      const alias = node.properties.alias ?? 'myint'
      return `${indent(ctx)}typedef ${origType} ${alias};\n`
    })
}
