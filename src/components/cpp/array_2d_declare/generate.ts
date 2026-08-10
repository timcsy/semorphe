/** `cpp:array_2d_declare` 的 **generate** 路——從共用檔原封剪過來（批次第十七批：宣告子分支）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:array_2d_declare', (node, ctx) => {
      const type = node.properties.type ?? 'int'
      const name = node.properties.name ?? 'arr'
      const rows = node.properties.rows ?? '3'
      const cols = node.properties.cols ?? '4'
      return `${indent(ctx)}${type} ${name}[${rows}][${cols}];\n`
    })
}
