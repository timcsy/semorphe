/** `cpp:class_declare` 的 **generate** 路：`class C;`／`struct C;` */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:class_declare', (node, ctx) => {
    const kw = node.properties.keyword === 'struct' ? 'struct' : 'class'
    return `${indent(ctx)}${kw} ${node.properties.name ?? 'MyClass'};\n`
  })
}
