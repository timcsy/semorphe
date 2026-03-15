import type { StylePreset } from '../../../../core/types'
import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../../core/projection/code-generator'

export function registerGenerators(g: Map<string, NodeGenerator>, _style: StylePreset): void {
  // Expression concepts
  g.set('cpp_map_access', (node, ctx) => {
    const obj = node.properties.obj ?? 'mp'
    const keyNodes = node.children.key ?? []
    const key = keyNodes.length > 0 ? generateExpression(keyNodes[0], ctx) : '0'
    return `${obj}[${key}]`
  })

  // Statement concepts
  g.set('cpp_map_declare', (node, ctx) => {
    const keyType = node.properties.key_type ?? 'int'
    const valueType = node.properties.value_type ?? 'int'
    const name = node.properties.name ?? 'mp'
    return `${indent(ctx)}map<${keyType}, ${valueType}> ${name};\n`
  })
}
