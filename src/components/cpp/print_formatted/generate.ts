/** `cpp:print_formatted` 的 **generate** 路——從共用檔原封剪過來（批次第三十八批）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
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
}
