/** `cpp:input` 的 **generate** 路——從共用檔原封剪過來（批次第三十九批）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import type { StylePreset } from '../../../core/types'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>, style: StylePreset): void {
  g.set('cpp:input', (node, ctx) => {
      const valueNodes = node.children.values ?? []
      const vars = valueNodes.length > 0
        ? valueNodes.map(v => generateExpression(v, ctx))
        : [String(node.properties.variable ?? 'x')]
      if (style.io_style === 'cout') {
        // 來源可能是一個**字串串流變數**（`in >> a`），不一定是標準輸入。
        // 一律產成 `cin` 的話，`istringstream` 的程式來回轉換之後會讀錯地方。
        const src = node.properties.from !== undefined ? String(node.properties.from) : 'cin'
        const expr = `${src} >> ${vars.join(' >> ')}`
        if (ctx.isExpression) return expr
        return `${indent(ctx)}${expr};\n`
      }
      if (ctx.isExpression) {
        // scanf in expression context (rare but handle gracefully)
        return vars.length === 1 ? `scanf("%d", &${vars[0]})` : `scanf("%d", &${vars.join(', &')})`
      }
      return vars.map(v => `${indent(ctx)}scanf("%d", &${v});\n`).join('')
    })
}
