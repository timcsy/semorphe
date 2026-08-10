import type { StylePreset } from '../../../../core/types'
import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { generateExpression } from '../../../../core/projection/code-generator'

export function registerGenerators(g: Map<string, NodeGenerator>, _style: StylePreset): void {
  // Expression concepts
  g.set('cpp:map_at', (node, ctx) => {
    const obj = node.properties.obj ?? 'mp'
    const keyNodes = node.children.key ?? []
    const key = keyNodes.length > 0 ? generateExpression(keyNodes[0], ctx) : '0'
    return `${obj}[${key}]`
  })




}
