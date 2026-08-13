/** `cpp:container_iter` 的 **generate** 路 */
import type { NodeGenerator } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:container_iter', (node) => {
    const obj = node.properties.obj ?? 'v'
    const which = node.properties.which ?? 'begin'
    return `${obj}.${which}()`
  })
}
