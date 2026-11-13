/** `cpp:var_declare_volatile` 的 **generate** 路（438）：`volatile T x = v;`／`volatile T x;` */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:var_declare_volatile', (node, ctx) => {
    const type = node.properties.type ?? 'bool'
    const name = node.properties.name ?? 'pressed'
    const inits = node.slots.initializer ?? []
    if (inits.length > 0) return `${indent(ctx)}volatile ${type} ${name} = ${generateExpression(inits[0], ctx)};\n`
    return `${indent(ctx)}volatile ${type} ${name};\n`
  })
}
