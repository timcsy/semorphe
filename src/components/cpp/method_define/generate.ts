/** `cpp:method_define` 的 **generate** 路（第 322 刀）——類別外的定義：`int A::get() const {…}`（大括號照風格，同類別裡定義方法那顆） */
import type { StylePreset } from '../../../core/types'
import { openBraceFor, formatParams } from '../../../languages/cpp/lang/generators/statements'
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, indented, generateBody, trackOwnText } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>, style: StylePreset): void {
  const openBrace = openBraceFor(style)
  g.set('cpp:method_define', (node, ctx) => {
    const qual = String(node.properties.is_const ?? 'false') === 'true' ? ' const' : ''
    const header = `${indent(ctx)}${node.properties.return_type ?? 'void'} ${node.properties.class_name ?? 'MyClass'}::${node.properties.name ?? 'method'}(${formatParams(node.slots.params ?? [])})${qual}${openBrace(ctx)}\n`
    trackOwnText(ctx, header)
    return header + generateBody(node.slots.body ?? [], indented(ctx)) + `${indent(ctx)}}\n`
  })
}
