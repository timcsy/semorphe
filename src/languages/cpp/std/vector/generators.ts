import type { StylePreset } from '../../../../core/types'
import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { indent } from '../../../../core/projection/code-generator'

export function registerGenerators(g: Map<string, NodeGenerator>, _style: StylePreset): void {
  // Expression concepts — return expression string (no indent, no newline)
  g.set('cpp_vector_size', (node) => {
    const vector = node.properties.vector ?? 'vec'
    return `${vector}.size()`
  })

  g.set('cpp_vector_back', (node) => {
    const vector = node.properties.vector ?? 'vec'
    return `${vector}.back()`
  })

  // Statement concepts — return full line with indent and newline
  g.set('cpp_vector_declare', (node, ctx) => {
    const type = node.properties.type ?? 'int'
    const name = node.properties.name ?? 'vec'
    return `${indent(ctx)}vector<${type}> ${name};\n`
  })

  g.set('cpp_vector_pop_back', (node, ctx) => {
    const vector = node.properties.vector ?? 'vec'
    return `${indent(ctx)}${vector}.pop_back();\n`
  })
}
