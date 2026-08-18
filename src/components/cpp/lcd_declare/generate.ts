/** `cpp:lcd_declare` 的 **generate** 路——⚠️ 建構參數個數是**動態**的（不同板子接法不同）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:lcd_declare', (node, ctx) => {
    const name = String(node.properties.name ?? 'lcd')
    // 🔴 **哪一個函式庫是學生自己選的，不是我們替他選的。**
    //    並列式與 I2C 的建構參數完全不同——改寫過去那支程式就編不過了。
    const type = String(node.properties.decl_type ?? 'LiquidCrystal')
    const args = (node.children.initializer ?? []).map((a) => generateExpression(a, ctx))
    // 🔴 沒有引數時**不得產出空的括號**——`LiquidCrystal s();` 在 C++ 裡是一個
    //    函式宣告，不是一個物件（最令人困惑的解析）。
    if (args.length === 0) return `${indent(ctx)}${type} ${name};\n`
    return `${indent(ctx)}${type} ${name}(${args.join(', ')});\n`
  })
}
