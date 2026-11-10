/** `cpp:friend_def` 的 **generate** 路（第 394 刀）：`friend int peek(const A& a) { … }` */
import type { StylePreset } from '../../../core/types'
import { openBraceFor, formatParams } from '../../../languages/cpp/lang/generators/statements'
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, indented, generateBody, trackOwnText } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>, style: StylePreset): void {
  const openBrace = openBraceFor(style)
  g.set('cpp:friend_def', (node, ctx) => {
    const header = `${indent(ctx)}friend ${node.properties.return_type ?? 'void'} ${node.properties.name ?? 'helper'}(${formatParams(node.slots.params ?? [])})${openBrace(ctx)}\n`
    trackOwnText(ctx, header)
    return header + generateBody(node.slots.body ?? [], indented(ctx)) + `${indent(ctx)}}\n`
  })
}
