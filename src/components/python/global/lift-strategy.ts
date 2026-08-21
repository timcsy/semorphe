/** `python:global` 的 **lift** 路——`global count`。 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:lift_global', (node) => {
    const names = node.namedChildren
    // ⚠️ `global a, b` 一次宣告多個——積木上只有一格，整顆降級
    if (names.length !== 1) return null
    return createNode('python:global', { name: names[0].text }, {})
  })
}
