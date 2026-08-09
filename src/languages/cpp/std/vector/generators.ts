import type { StylePreset } from '../../../../core/types'
import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { indent } from '../../../../core/projection/code-generator'

export function registerGenerators(g: Map<string, NodeGenerator>, _style: StylePreset): void {
  // Expression concepts — return expression string (no indent, no newline)
  g.set('cpp:vector_size', (node) => {
    const vector = node.properties.obj ?? 'vec'
    return `${vector}.size()`
  })

  g.set('cpp:vector_back', (node) => {
    const vector = node.properties.obj ?? 'vec'
    return `${vector}.back()`
  })

  // Statement concepts — return full line with indent and newline
  g.set('cpp:vector_pop', (node, ctx) => {
    const vector = node.properties.obj ?? 'vec'
    return `${indent(ctx)}${vector}.pop_back();\n`
  })
}
