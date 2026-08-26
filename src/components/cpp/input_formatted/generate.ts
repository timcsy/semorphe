/** `cpp:input_formatted` 的 **generate** 路——從共用檔原封剪過來（批次第三十八批）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'
// ⚠️ 問**性狀**不問身分——一顆膠囊裡寫另一顆的身分，反向檢查會指名。
import { isAddressable } from '../../../languages/cpp/core/node-traits'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  // cpp_input_formatted with structured args + auto & for simple vars (0 or more)
    g.set('cpp:input_formatted', (node, ctx) => {
      const format = (node.properties.format as string) ?? '%d'
      const argNodes = node.children.args ?? []
      if (argNodes.length > 0) {
        const args = argNodes.map(a => {
          const expr = generateExpression(a, ctx)
          // 🔴 **問「取得到位址嗎」，不問「它是不是一個變數參照」**（2026-08-26）。
          //
          // 這裡本來寫 `isVariableRef(a.componentId) && !a.properties.noAddr`，
          // 而那有兩個問題：
          //   ① `&a[i]` 的 `&` 掉了——`scanf("%d", &a[i])` 來回變成
          //      `scanf("%d", a[i])`，**編不過**（抓到它的是來回轉換的實測）
          //   ② `noAddr` 這個屬性**從來沒有人設過**——一個永遠是 undefined 的條件
          //
          // > **一個永遠不會成立的條件，讀起來像一條規則，而它什麼都沒管到。**
          if (isAddressable(a.componentId)) return `&${expr}`
          // 其餘（運算式、已經是位址的東西）照原樣
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
