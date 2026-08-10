/** `cpp:using_alias` 的 **generate** 路——從共用檔原封剪過來（批次第三批：lift 是只產一種身分的具名策略）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:using_alias', (node, ctx) => {
      const alias = node.properties.alias ?? 'll'
      const origType = node.properties.orig_type ?? 'long long'
      return `${indent(ctx)}using ${alias} = ${origType};\n`
    })
}
