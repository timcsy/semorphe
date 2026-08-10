import type { StylePreset } from '../../../../core/types'
import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../../core/projection/code-generator'

export function registerGenerators(g: Map<string, NodeGenerator>, _style: StylePreset): void {
  g.set('cpp:range_sort', (node, ctx) => {
    const begin = node.properties.begin ?? 'v.begin()'
    const end = node.properties.end ?? 'v.end()'
    return `${indent(ctx)}sort(${begin}, ${end});\n`
  })

  g.set('cpp:range_reverse', (node, ctx) => {
    const begin = node.properties.begin ?? 'v.begin()'
    const end = node.properties.end ?? 'v.end()'
    return `${indent(ctx)}reverse(${begin}, ${end});\n`
  })

  g.set('cpp:range_fill', (node, ctx) => {
    const begin = node.properties.begin ?? 'v.begin()'
    const end = node.properties.end ?? 'v.end()'
    const valueNodes = node.children.value ?? []
    const value = valueNodes.length > 0 ? generateExpression(valueNodes[0], ctx) : '0'
    return `${indent(ctx)}fill(${begin}, ${end}, ${value});\n`
  })






}
