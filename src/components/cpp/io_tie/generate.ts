/** `cpp:io_tie` 的 **generate** 路 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:io_tie', (node, ctx) => {
    const obj = node.properties.obj ?? 'cin'
    const value = node.children.value?.[0]
    // 引數缺席補 `nullptr`——`tie()` 不帶引數是**查詢**（回傳目前綁的流），
    // 而這顆積木說的是「設定」。少了引數會安靜地變成另一個意思。
    const arg = value ? generateExpression(value, ctx) : 'nullptr'
    return `${indent(ctx)}${obj}.tie(${arg});\n`
  })
}
