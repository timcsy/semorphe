import type { StylePreset } from '../../../../core/types'
import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { generateExpression } from '../../../../core/projection/code-generator'

export function registerGenerators(g: Map<string, NodeGenerator>, _style: StylePreset): void {
  g.set('cpp_accumulate', (node, ctx) => {
    const begin = (node.properties.begin as string) ?? 'v.begin()'
    const end = (node.properties.end as string) ?? 'v.end()'
    const init = generateExpression((node.children.init ?? [])[0], ctx)
    return `std::accumulate(${begin}, ${end}, ${init})`
  })
}
