/** `cpp:pair_declare` 的 **generate** 路——從共用檔原封剪過來（批次第七批：容器樣板過渡表退場）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:pair_declare', (node, ctx) => {
      const type1 = (node.properties.type1 as string) ?? 'int'
      const type2 = (node.properties.type2 as string) ?? 'int'
      const name = (node.properties.name as string) ?? 'p'
      return `${indent(ctx)}pair<${type1}, ${type2}> ${name};\n`
    })
}
