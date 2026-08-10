/** `cpp:var_declare_auto` 的 **generate** 路——從共用檔原封剪過來（批次第二十批：建構子）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:var_declare_auto', (node, ctx) => {
      const name = node.properties.name ?? 'x'
      const inits = node.children.initializer ?? []
      if (inits.length > 0) {
        const val = generateExpression(inits[0], ctx)
        return `${indent(ctx)}auto ${name} = ${val};\n`
      }
      return `${indent(ctx)}auto ${name};\n`
    })
}
