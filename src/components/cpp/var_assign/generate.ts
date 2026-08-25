/**
 * `cpp:var_assign` 的 **generate** 路。
 *
 * 🟢 **左邊是一顆節點**（2026-08-25）——`o.x = 1`／`p->x = 1`／`*q = 1`／
 * `a.b.c = 1` 都由同一支產生器產得出來，因為左邊走的是**一般的運算式產生**。
 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:var_assign', (node, ctx) => {
    const targets = node.children.target ?? []
    // ⚠️ 左邊缺席時退回 `x`——與同族一致，而**不是**靜默丟掉這一行。
    const target = targets.length > 0 ? generateExpression(targets[0], ctx) : 'x'
    const vals = node.children.value ?? []
    if (vals.length > 0) {
      return `${indent(ctx)}${target} = ${generateExpression(vals[0], ctx)};\n`
    }
    return `${indent(ctx)}${target};\n`
  })
}
