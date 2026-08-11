/** `cpp:input_formatted` 的 **generate** 路——從共用檔原封剪過來（批次第三十八批）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'
// ⚠️ 問**性狀**不問身分——一顆膠囊裡寫另一顆的身分，反向檢查會指名。
import { isVariableRef } from '../../../languages/cpp/core/node-traits'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  // cpp_input_formatted with structured args + auto & for simple vars (0 or more)
    g.set('cpp:input_formatted', (node, ctx) => {
      const format = (node.properties.format as string) ?? '%d'
      const argNodes = node.children.args ?? []
      if (argNodes.length > 0) {
        const args = argNodes.map(a => {
          const expr = generateExpression(a, ctx)
          // var_ref nodes need & prefix (unless array/string/pointer)
          if (isVariableRef(a.conceptId) && !a.properties.noAddr) {
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
}
