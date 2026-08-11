/** `cpp:var_declare_ref` 的 **generate** 路——從共用檔原封剪過來（批次第三十批）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:var_declare_ref', (node, ctx) => {
      const type = node.properties.type ?? 'int'
      const name = node.properties.name ?? 'ref'
      const inits = node.children.initializer ?? []
      if (inits.length > 0) {
        const val = generateExpression(inits[0], ctx)
        return `${indent(ctx)}${type}& ${name} = ${val};\n`
      }
      return `${indent(ctx)}${type}& ${name};\n`
    })
}
