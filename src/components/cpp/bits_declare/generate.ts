/** `cpp:bits_declare` 的 **generate** 路。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:bits_declare', (node, ctx) => {
    const name = String(node.properties.name ?? 'bs')
    const sizeNodes = node.slots.size ?? []
    /**
     * 🔴 **沒有大小就產出 `<0>`——不得編一個出來。**
     * 同族的一般陣列記過同一條：一個看起來合理的預設值（那裡是 `10`）
     * 把「這裡沒有資料」偽裝成「這裡的資料是 10」，而那不是排版差異，是語義改變。
     * ⚠️ `bitset<>` 不是合法的 C++，所以**留一個 0 讓它編不過**比悄悄補一個數字好。
     */
    const size = sizeNodes.length > 0 ? generateExpression(sizeNodes[0], ctx) : '0'
    // 初始值三態：沒有這一格 → 不初始化；有 → `= …`
    const src = (node.slots.source ?? [])[0]
    const init = src ? ` = ${generateExpression(src, ctx)}` : ''
    return `${indent(ctx)}bitset<${size}> ${name}${init};\n`
  })
}
