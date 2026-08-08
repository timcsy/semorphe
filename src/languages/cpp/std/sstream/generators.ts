import type { StylePreset } from '../../../../core/types'
import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../../core/projection/code-generator'

export function registerGenerators(g: Map<string, NodeGenerator>, _style: StylePreset): void {
  g.set('cpp:istringstream_declare', (node, ctx) => {
    const name = node.properties.name ?? 'in'
    const src = node.children.source ?? []
    const arg = src.length > 0 ? generateExpression(src[0], ctx) : ''
    return `${indent(ctx)}istringstream ${name}(${arg});\n`
  })

  g.set('cpp:stringstream_declare', (node, ctx) => {
    const name = (node.properties.name as string) ?? 'ss'
    return `${indent(ctx)}stringstream ${name};\n`
  })
}
