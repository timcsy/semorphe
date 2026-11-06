/** `cpp:destructor_def_outside` 的 **generate** 路（第 322 刀）——`A::~A() {…}` */
import type { StylePreset } from '../../../core/types'
import { openBraceFor } from '../../../languages/cpp/lang/generators/statements'
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, indented, generateBody, trackOwnText } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>, style: StylePreset): void {
  const openBrace = openBraceFor(style)
  g.set('cpp:destructor_def_outside', (node, ctx) => {
    const cls = node.properties.class_name ?? 'MyClass'
    const header = `${indent(ctx)}${cls}::~${cls}()${openBrace(ctx)}\n`
    trackOwnText(ctx, header)
    return header + generateBody(node.slots.body ?? [], indented(ctx)) + `${indent(ctx)}}\n`
  })
}
