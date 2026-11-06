/** `cpp:destructor_declare` 的 **generate** 路（第 322 刀）——類別裡的一行：`~A();`、`virtual ~A();` */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, trackOwnText } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:destructor_declare', (node, ctx) => {
    const v = String(node.properties.is_virtual ?? 'false')
    const line = `${indent(ctx)}${v === 'true' ? 'virtual ' : ''}~${node.properties.class_name ?? 'MyClass'}()${v === 'override' ? ' override' : ''};\n`
    trackOwnText(ctx, line)
    return line
  })
}
