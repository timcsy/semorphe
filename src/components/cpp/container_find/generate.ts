/** `cpp:container_find` 的 **generate** 路 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:container_find', (node, ctx) => {
    const obj = node.properties.obj ?? 's'
    const how = node.properties.how ?? 'find'
    const key = (node.slots.key ?? [])[0]
    return `${obj}.${how}(${key ? generateExpression(key, ctx) : ''})`
  })
}
