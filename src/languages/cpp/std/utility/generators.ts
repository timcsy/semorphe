import type { StylePreset } from '../../../../core/types'
import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../../core/projection/code-generator'

export function registerGenerators(g: Map<string, NodeGenerator>, _style: StylePreset): void {
  g.set('cpp_pair_declare', (node, ctx) => {
    const type1 = (node.properties.type1 as string) ?? 'int'
    const type2 = (node.properties.type2 as string) ?? 'int'
    const name = (node.properties.name as string) ?? 'p'
    return `${indent(ctx)}pair<${type1}, ${type2}> ${name};\n`
  })

  g.set('cpp_make_pair', (node, ctx) => {
    const first = generateExpression((node.children.first ?? [])[0], ctx)
    const second = generateExpression((node.children.second ?? [])[0], ctx)
    return `make_pair(${first}, ${second})`
  })
}
