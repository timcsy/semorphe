import type { StylePreset } from '../../../../core/types'
import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../../core/projection/code-generator'

export function registerGenerators(g: Map<string, NodeGenerator>, _style: StylePreset): void {
  // Expression concepts
  g.set('cpp_queue_front', (node) => {
    const obj = node.properties.obj ?? 'q'
    return `${obj}.front()`
  })

  g.set('cpp_queue_empty', (node) => {
    const obj = node.properties.obj ?? 'q'
    return `${obj}.empty()`
  })

  // Statement concepts
  g.set('cpp_queue_declare', (node, ctx) => {
    const type = node.properties.type ?? 'int'
    const name = node.properties.name ?? 'q'
    return `${indent(ctx)}queue<${type}> ${name};\n`
  })

  g.set('cpp_queue_push', (node, ctx) => {
    const obj = node.properties.obj ?? 'q'
    const valueNodes = node.children.value ?? []
    const val = valueNodes.length > 0 ? generateExpression(valueNodes[0], ctx) : '0'
    return `${indent(ctx)}${obj}.push(${val});\n`
  })

  g.set('cpp_queue_pop', (node, ctx) => {
    const obj = node.properties.obj ?? 'q'
    return `${indent(ctx)}${obj}.pop();\n`
  })
}
