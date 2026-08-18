/**
 * `cpp:pulse_read` 的 **generate** 路。
 *
 * 🔴 第三個引數**有才產**——沒有的話不能產出一個空的逗號（`pulseIn(7, HIGH,)` 編不過）。
 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:pulse_read', (node, ctx) => {
    const pin = generateExpression((node.children.pin ?? [])[0], ctx)
    const state = generateExpression((node.children.state ?? [])[0], ctx)
    const toNode = (node.children.timeout ?? [])[0]
    const args = toNode ? `${pin}, ${state}, ${generateExpression(toNode, ctx)}` : `${pin}, ${state}`
    return `pulseIn(${args})`
  })
}
