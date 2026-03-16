import type { StylePreset } from '../../../../core/types'
import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../../core/projection/code-generator'

export function registerGenerators(g: Map<string, NodeGenerator>, _style: StylePreset): void {
  g.set('cpp_ifstream_declare', (node, ctx) => {
    const name = (node.properties.name as string) ?? 'fin'
    // Support both property-based (from block) and children-based (from lifter) init
    const initNodes = node.children.initializer ?? []
    if (initNodes.length > 0) {
      const val = generateExpression(initNodes[0], ctx)
      return `${indent(ctx)}ifstream ${name}(${val});\n`
    }
    const file = (node.properties.file as string) ?? 'input.txt'
    return `${indent(ctx)}ifstream ${name}("${file}");\n`
  })

  g.set('cpp_ofstream_declare', (node, ctx) => {
    const name = (node.properties.name as string) ?? 'fout'
    const initNodes = node.children.initializer ?? []
    if (initNodes.length > 0) {
      const val = generateExpression(initNodes[0], ctx)
      return `${indent(ctx)}ofstream ${name}(${val});\n`
    }
    const file = (node.properties.file as string) ?? 'output.txt'
    return `${indent(ctx)}ofstream ${name}("${file}");\n`
  })
}
