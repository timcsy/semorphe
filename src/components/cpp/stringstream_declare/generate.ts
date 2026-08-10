/** `cpp:stringstream_declare` 的 **generate** 路——從共用檔原封剪過來（批次第十六批：型別名資料表）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:stringstream_declare', (node, ctx) => {
      const name = (node.properties.name as string) ?? 'ss'
      return `${indent(ctx)}stringstream ${name};\n`
    })
}
