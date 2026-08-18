/**
 * `cpp:tone` 的 **generate** 路。
 *
 * 🔴 第三個引數**有才產**——沒有的話不能產出一個空的逗號（`tone(8, 440,)` 編不過）。
 * ⚠️ 與 `cpp:serial_print` 的第二個引數同一種處理。
 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:tone', (node, ctx) => {
    const pin = generateExpression((node.children.pin ?? [])[0], ctx)
    const freq = generateExpression((node.children.frequency ?? [])[0], ctx)
    const durNode = (node.children.duration ?? [])[0]
    const args = durNode ? `${pin}, ${freq}, ${generateExpression(durNode, ctx)}` : `${pin}, ${freq}`
    return `${indent(ctx)}tone(${args});\n`
  })
}
