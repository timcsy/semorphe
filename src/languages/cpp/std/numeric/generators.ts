import type { StylePreset } from '../../../../core/types'
import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../../core/projection/code-generator'

export function registerGenerators(g: Map<string, NodeGenerator>, _style: StylePreset): void {
  g.set('cpp_accumulate', (node, ctx) => {
    const begin = (node.properties.begin as string) ?? 'v.begin()'
    const end = (node.properties.end as string) ?? 'v.end()'
    const init = generateExpression((node.children.init ?? [])[0], ctx)
    return `accumulate(${begin}, ${end}, ${init})`
  })

  g.set('cpp_iota', (node, ctx) => {
    const begin = (node.properties.begin as string) ?? 'v.begin()'
    const end = (node.properties.end as string) ?? 'v.end()'
    const value = generateExpression((node.children.value ?? [])[0], ctx)
    return `${indent(ctx)}iota(${begin}, ${end}, ${value});\n`
  })

  g.set('cpp_partial_sum', (node, ctx) => {
    const begin = (node.properties.begin as string) ?? 'v.begin()'
    const end = (node.properties.end as string) ?? 'v.end()'
    const dest = (node.properties.dest as string) ?? 'result.begin()'
    return `${indent(ctx)}partial_sum(${begin}, ${end}, ${dest});\n`
  })

  g.set('cpp_gcd', (node, ctx) => {
    const a = generateExpression((node.children.a ?? [])[0], ctx)
    const b = generateExpression((node.children.b ?? [])[0], ctx)
    return `__gcd(${a}, ${b})`
  })

  g.set('cpp_lcm', (node, ctx) => {
    const a = generateExpression((node.children.a ?? [])[0], ctx)
    const b = generateExpression((node.children.b ?? [])[0], ctx)
    return `lcm(${a}, ${b})`
  })
}
