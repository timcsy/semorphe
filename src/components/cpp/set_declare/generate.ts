/** `cpp:set_declare` 的 **generate** 路——從共用檔原封剪過來（批次第七批：容器樣板過渡表退場）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  // Statement components
    g.set('cpp:set_declare', (node, ctx) => {
      const type = node.properties.type ?? 'int'
      const name = node.properties.name ?? 's'
      return `${indent(ctx)}set<${type}> ${name};\n`
    })
}
