import type { StylePreset } from '../../../../core/types'
import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../../core/projection/code-generator'

export function registerGenerators(g: Map<string, NodeGenerator>, _style: StylePreset): void {
  g.set('cpp_sort', (node, ctx) => {
    const begin = node.properties.begin ?? 'v.begin()'
    const end = node.properties.end ?? 'v.end()'
    return `${indent(ctx)}sort(${begin}, ${end});\n`
  })

  g.set('cpp_reverse', (node, ctx) => {
    const begin = node.properties.begin ?? 'v.begin()'
    const end = node.properties.end ?? 'v.end()'
    return `${indent(ctx)}reverse(${begin}, ${end});\n`
  })

  g.set('cpp_fill', (node, ctx) => {
    const begin = node.properties.begin ?? 'v.begin()'
    const end = node.properties.end ?? 'v.end()'
    const valueNodes = node.children.value ?? []
    const value = valueNodes.length > 0 ? generateExpression(valueNodes[0], ctx) : '0'
    return `${indent(ctx)}fill(${begin}, ${end}, ${value});\n`
  })

  g.set('cpp_min', (node, ctx) => {
    const aNodes = node.children.a ?? []
    const bNodes = node.children.b ?? []
    const a = aNodes.length > 0 ? generateExpression(aNodes[0], ctx) : '0'
    const b = bNodes.length > 0 ? generateExpression(bNodes[0], ctx) : '0'
    return `min(${a}, ${b})`
  })

  g.set('cpp_max', (node, ctx) => {
    const aNodes = node.children.a ?? []
    const bNodes = node.children.b ?? []
    const a = aNodes.length > 0 ? generateExpression(aNodes[0], ctx) : '0'
    const b = bNodes.length > 0 ? generateExpression(bNodes[0], ctx) : '0'
    return `max(${a}, ${b})`
  })

  g.set('cpp_swap', (node, ctx) => {
    const a = node.properties.a ?? 'a'
    const b = node.properties.b ?? 'b'
    return `${indent(ctx)}swap(${a}, ${b});\n`
  })
}
