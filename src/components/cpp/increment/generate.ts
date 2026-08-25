/**
 * `cpp:increment` 的 **generate** 路。
 *
 * 🟢 **運算元是一顆節點**（2026-08-25）——`a[i]++`／`o.x++`／`p->x++`
 * 都由同一支產生器產得出來，因為它走的是**一般的運算式產生**。
 * 🪦 在此之前這裡有一段 `${name}[${idx}]` 的字串拼裝——那是形狀的列舉。
 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:increment', (node, ctx) => {
    // 🪦 **大寫的回退（`OP`／`POSITION`）已於 2026-08-25 刪除**——
    //    它們是遺留：抽取器的 `renderMapping` 早就把欄位映成小寫的屬性名，
    //    而第三十四條護欄把它們報成「讀了沒宣告」。
    // > **一個永遠不會命中的回退，是一份沒有人會發現已經過期的宣告。**
    const op = String(node.properties.operator ?? '++')
    const pos = String(node.properties.position ?? 'postfix')
    const targets = node.children.target ?? []
    // ⚠️ 運算元缺席時退回 `i`——與同族一致，而**不是**靜默丟掉這一行。
    const target = targets.length > 0 ? generateExpression(targets[0], ctx) : 'i'
    const expr = pos === 'prefix' ? `${op}${target}` : `${target}${op}`
    if (ctx.isExpression) return expr
    return `${indent(ctx)}${expr};\n`
  })
}
