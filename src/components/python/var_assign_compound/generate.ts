/**
 * `python:var_assign_compound` 的 **generate** 路——`total += i`（**沒有分號**）。
 *
 * 🟢 **左邊是一顆節點**（2026-08-25）——`a[i] += 1`／`o.x += 1`／`a.b.c += 1`
 * 都由同一支產生器產得出來，因為左邊走的是**一般的運算式產生**。
 * 在此之前它是一個字串屬性，於是「支援哪幾種左值」變成一份列舉。
 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:var_assign_compound', (node, ctx) => {
    const targets = node.children.target ?? []
    // ⚠️ 左邊缺席時退回 `x`——與同族的指派一致，而**不是**靜默丟掉這一行。
    const target = targets.length > 0 ? generateExpression(targets[0], ctx) : 'x'
    const op = node.properties.operator ?? '+='
    const vals = node.children.value ?? []
    const val = vals.length > 0 ? generateExpression(vals[0], ctx) : '0'
    return `${indent(ctx)}${target} ${op} ${val}\n`
  })
}
