import type { StylePreset } from '../../../../core/types'
import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../../core/projection/code-generator'

export function registerGenerators(g: Map<string, NodeGenerator>, _style: StylePreset): void {


  g.set('cpp:set_insert', (node, ctx) => {
    const obj = node.properties.obj ?? 's'
    const valueNodes = node.children.value ?? []
    const val = valueNodes.length > 0 ? generateExpression(valueNodes[0], ctx) : '0'
    return `${indent(ctx)}${obj}.insert(${val});\n`
  })
}
