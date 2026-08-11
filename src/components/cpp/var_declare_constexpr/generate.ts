/** `cpp:var_declare_constexpr` 的 **generate** 路——從共用檔原封剪過來（批次第二十二批：修飾詞 → 身分的登錄）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:var_declare_constexpr', (node, ctx) => {
      const type = node.properties.type ?? 'int'
      const name = node.properties.name ?? 'SIZE'
      const inits = node.children.initializer ?? []
      if (inits.length > 0) {
        const val = generateExpression(inits[0], ctx)
        return `${indent(ctx)}constexpr ${type} ${name} = ${val};\n`
      }
      return `${indent(ctx)}constexpr ${type} ${name};\n`
    })
}
