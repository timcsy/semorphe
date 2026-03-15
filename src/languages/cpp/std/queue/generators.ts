import type { StylePreset } from '../../../../core/types'
import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { indent } from '../../../../core/projection/code-generator'

export function registerGenerators(g: Map<string, NodeGenerator>, _style: StylePreset): void {
  // Expression concepts
  g.set('cpp_queue_front', (node) => {
    const obj = node.properties.obj ?? 'q'
    return `${obj}.front()`
  })

  // Statement concepts
  g.set('cpp_queue_declare', (node, ctx) => {
    const type = node.properties.type ?? 'int'
    const name = node.properties.name ?? 'q'
    return `${indent(ctx)}queue<${type}> ${name};\n`
  })
}
