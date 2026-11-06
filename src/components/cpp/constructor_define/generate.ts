/** `cpp:constructor_define` 的 **generate** 路（第 322 刀）——`A::A(int v) : x(v) {…}`（初始化列同類別裡定義建構子那顆：`v = x` → `v(x)`） */
import type { StylePreset } from '../../../core/types'
import { openBraceFor, formatParams } from '../../../languages/cpp/lang/generators/statements'
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, indented, generateBody, trackOwnText, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>, style: StylePreset): void {
  const openBrace = openBraceFor(style)
  g.set('cpp:constructor_define', (node, ctx) => {
    const cls = node.properties.class_name ?? 'MyClass'
    const inits = node.slots.inits ?? []
    const initStr = inits.length > 0
      ? ` : ${inits.map((n) => {
        const t = (n.slots?.target ?? [])[0]
        return `${t ? generateExpression(t, ctx) : 'x'}(${generateExpression((n.slots?.value ?? [])[0], ctx)})`
      }).join(', ')}`
      : ''
    const header = `${indent(ctx)}${cls}::${cls}(${formatParams(node.slots.params ?? [])})${initStr}${openBrace(ctx)}\n`
    trackOwnText(ctx, header)
    return header + generateBody(node.slots.body ?? [], indented(ctx)) + `${indent(ctx)}}\n`
  })
}
