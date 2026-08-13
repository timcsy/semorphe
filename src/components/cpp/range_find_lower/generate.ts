/** `cpp:range_find_lower` 的 **generate** 路 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:range_find_lower', (node, ctx) => {
      const begin = (node.properties.begin as string) ?? 'v.begin()'
      const end = (node.properties.end as string) ?? 'v.end()'
      const value = generateExpression((node.children.value ?? [])[0], ctx)
      return `lower_bound(${begin}, ${end}, ${value})`
    })
}
