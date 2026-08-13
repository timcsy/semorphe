/** `cpp:range_max` 的 **generate** 路 */
import type { NodeGenerator } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:range_max', (node) => {
      const begin = (node.properties.begin as string) ?? 'v.begin()'
      const end = (node.properties.end as string) ?? 'v.end()'
      return `max_element(${begin}, ${end})`
    })
}
