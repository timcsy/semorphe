import type { StylePreset } from '../../../../core/types'
import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { generateExpression } from '../../../../core/projection/code-generator'

export function registerGenerators(g: Map<string, NodeGenerator>, _style: StylePreset): void {








  g.set('cpp:string_at', (node, ctx) => {
    const obj = node.properties.obj ?? 'str'
    const indexNodes = node.children.index ?? []
    const index = indexNodes.length > 0 ? generateExpression(indexNodes[0], ctx) : '0'
    return `${obj}[${index}]`
  })






















}
