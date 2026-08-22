/** `python:splat` 的 **lift** 路——`*nums` / `**d`。`kind` 來自節點型別。 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:liftSplat', (node, ctx) => {
    const inner = node.namedChildren[0]
    const lifted = inner ? ctx.lift(inner) : null
    if (!lifted) return null
    return createNode('python:splat',
      { kind: node.type === 'dictionary_splat' ? 'dict' : 'list' }, { value: [lifted] })
  })
}
