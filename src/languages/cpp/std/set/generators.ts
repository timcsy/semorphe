import type { StylePreset } from '../../../../core/types'
import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../../core/projection/code-generator'

export function registerGenerators(g: Map<string, NodeGenerator>, _style: StylePreset): void {
  // Expression concepts
  g.set('cpp_set_count', (node, ctx) => {
    const obj = node.properties.obj ?? 's'
    const valueNodes = node.children.value ?? []
    const val = valueNodes.length > 0 ? generateExpression(valueNodes[0], ctx) : '0'
    return `${obj}.count(${val})`
  })

  g.set('cpp_set_empty', (node) => {
    const obj = node.properties.obj ?? 's'
    return `${obj}.empty()`
  })

  // Statement concepts
  g.set('cpp_set_declare', (node, ctx) => {
    const type = node.properties.type ?? 'int'
    const name = node.properties.name ?? 's'
    return `${indent(ctx)}set<${type}> ${name};\n`
  })

  g.set('cpp_set_insert', (node, ctx) => {
    const obj = node.properties.obj ?? 's'
    const valueNodes = node.children.value ?? []
    const val = valueNodes.length > 0 ? generateExpression(valueNodes[0], ctx) : '0'
    return `${indent(ctx)}${obj}.insert(${val});\n`
  })

  g.set('cpp_set_erase', (node, ctx) => {
    const obj = node.properties.obj ?? 's'
    const valueNodes = node.children.value ?? []
    const val = valueNodes.length > 0 ? generateExpression(valueNodes[0], ctx) : '0'
    return `${indent(ctx)}${obj}.erase(${val});\n`
  })
}
