/** `cpp:func_call` 的 **generate** 路——從共用檔原封剪過來（批次第三十七批）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:func_call', (node, ctx) => {
      // ⚠️ **位置感知**：同一個身分在敘述位置與運算式位置產出不同的**文字形式**
      // （分號與縮排），但那是**形態**不是身分。`ctx.isExpression` 這個機制一直
      // 都在（`cpp_increment` 與 `cpp_compound_assign` 早就在用），而這四個
      // 沒有用它——於是被迫存在一個 `_expr` 雙胞胎概念。B 項合併掉那六對。
      const name = node.properties.name ?? 'f'
      const args = (node.children.args ?? []).map(a => generateExpression(a, ctx))
      const expr = `${name}(${args.join(', ')})`
      if (ctx.isExpression) return expr
      return `${indent(ctx)}${expr};\n`
    })
}
