import type { StylePreset } from '../../../../core/types'
import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../../core/projection/code-generator'

export function registerCstdioGenerators(g: Map<string, NodeGenerator>, _style: StylePreset): void {
  // cpp_print_formatted with structured args (0 or more)
  g.set('cpp:print_formatted', (node, ctx) => {
    const format = (node.properties.format as string) ?? '%d\\n'
    const argNodes = node.children.args ?? []
    if (argNodes.length > 0) {
      const args = argNodes.map(a => generateExpression(a, ctx))
      return `${indent(ctx)}printf("${format}", ${args.join(', ')});\n`
    }
    // ⚠️ **這裡原本有一條 legacy fallback**：`node.properties.args` 存在就用它。
    // 而 `args` **從來不是屬性**——lift 產出的是接點（實測：屬性出現 0 次）。
    // 那條分支永遠走不到，卻讓宣告必須同時列出屬性與接點兩份（`specs/106`）。
    // 刪掉它，宣告才收得乾淨。存檔遷移從來沒有產生過這個屬性。
    return `${indent(ctx)}printf("${format}");\n`
  })

  // cpp_input_formatted with structured args + auto & for simple vars (0 or more)
  g.set('cpp:input_formatted', (node, ctx) => {
    const format = (node.properties.format as string) ?? '%d'
    const argNodes = node.children.args ?? []
    if (argNodes.length > 0) {
      const args = argNodes.map(a => {
        const expr = generateExpression(a, ctx)
        // var_ref nodes need & prefix (unless array/string/pointer)
        if (a.conceptId === 'cpp:var_ref' && !a.properties.noAddr) {
          return `&${expr}`
        }
        // no-addr var_ref, or compose/custom: user already controls &
        return expr
      })
      const expr = `scanf("${format}", ${args.join(', ')})`
      if (ctx.isExpression) return expr
      return `${indent(ctx)}${expr};\n`
    }
    // 同上：`args` 從來不是屬性，那條 legacy fallback 永遠走不到。
    const expr = `scanf("${format}")`
    if (ctx.isExpression) return expr
    return `${indent(ctx)}${expr};\n`
  })

  // Expression version of scanf (for use in for-loop init/update)
}
