import type { StylePreset } from '../../../../core/types'
import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../../core/projection/code-generator'

export function registerGenerators(g: Map<string, NodeGenerator>, _style: StylePreset): void {








  g.set('cpp:string_at', (node, ctx) => {
    const obj = node.properties.obj ?? 'str'
    const indexNodes = node.children.index ?? []
    const index = indexNodes.length > 0 ? generateExpression(indexNodes[0], ctx) : '0'
    return `${obj}[${index}]`
  })







  // Statement concepts — return full line with indent and newline
  g.set('cpp:string_declare', (node, ctx) => {
    const name = node.properties.name ?? 'str'
    const initNodes = node.children.initializer ?? []
    if (initNodes.length > 0) {
      const val = generateExpression(initNodes[0], ctx)
      return `${indent(ctx)}string ${name} = ${val};\n`
    }
    return `${indent(ctx)}string ${name};\n`
  })











  g.set('cpp:string_append_char', (node, ctx) => {
    const obj = node.properties.obj ?? 'str'
    const charNodes = node.children.char ?? []
    const ch = charNodes.length > 0 ? generateExpression(charNodes[0], ctx) : "'a'"
    return `${indent(ctx)}${obj}.push_back(${ch});\n`
  })

  g.set('cpp:string_clear', (node, ctx) => {
    const obj = node.properties.obj ?? 'str'
    return `${indent(ctx)}${obj}.clear();\n`
  })
}
