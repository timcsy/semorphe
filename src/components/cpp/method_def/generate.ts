/** `cpp:method_def` 的 **generate** 路（第 218 刀）——照同族的虛擬方法那顆，多寫尾端的 const。 */
import type { StylePreset } from '../../../core/types'
import { openBraceFor, formatParams } from '../../../languages/cpp/lang/generators/statements'
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, indented, generateBody, trackOwnText } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>, style: StylePreset): void {
  const openBrace = openBraceFor(style)
  g.set('cpp:method_def', (node, ctx) => {
    const returnType = node.properties.return_type ?? 'void'
    const name = node.properties.name ?? 'method'
    const paramStr = formatParams(node.slots.params ?? [])
    // 尾端的 const——少了它，在 const 物件（`const P&`）上呼叫就編不過
    const qual = String(node.properties.is_const ?? 'false') === 'true' ? ' const' : ''
    const header = `${indent(ctx)}${returnType} ${name}(${paramStr})${qual}${openBrace(ctx)}\n`
    trackOwnText(ctx, header)
    return header + generateBody(node.slots.body ?? [], indented(ctx)) + `${indent(ctx)}}\n`
  })
}
