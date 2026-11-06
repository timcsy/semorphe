/** `cpp:constructor_declare` 的 **generate** 路（第 322 刀）——類別裡的一行：`A(int v);` */
import { formatParams } from '../../../languages/cpp/lang/generators/statements'
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, trackOwnText } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:constructor_declare', (node, ctx) => {
    const line = `${indent(ctx)}${String(node.properties.is_explicit ?? 'false') === 'true' ? 'explicit ' : ''}${node.properties.class_name ?? 'MyClass'}(${formatParams(node.slots.params ?? [])});\n`
    trackOwnText(ctx, line)
    return line
  })
}
