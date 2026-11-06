/** `cpp:method_declare` 的 **generate** 路（第 322 刀）——類別裡的一行原型：`int get() const;` */
import { formatParams } from '../../../languages/cpp/lang/generators/statements'
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, trackOwnText } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:method_declare', (node, ctx) => {
    const qual = String(node.properties.is_const ?? 'false') === 'true' ? ' const' : ''
    const virt = String(node.properties.virt ?? 'none')
    const line = `${indent(ctx)}${virt === 'virtual' ? 'virtual ' : ''}${node.properties.return_type ?? 'void'} ${node.properties.name ?? 'method'}(${formatParams(node.slots.params ?? [])})${qual}${virt === 'override' ? ' override' : ''};\n`
    trackOwnText(ctx, line)
    return line
  })
}
