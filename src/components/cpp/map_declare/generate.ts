/** `cpp:map_declare` 的 **generate** 路——從共用檔原封剪過來（批次第七批：容器樣板過渡表退場）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  // Statement concepts
    g.set('cpp:map_declare', (node, ctx) => {
      const keyType = node.properties.key_type ?? 'int'
      const valueType = node.properties.value_type ?? 'int'
      const name = node.properties.name ?? 'mp'
      return `${indent(ctx)}map<${keyType}, ${valueType}> ${name};\n`
    })
}
