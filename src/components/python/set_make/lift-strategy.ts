/**
 * `python:set_make` 的 **lift** 路——`{1, 2, 3}`。
 *
 * ⚠️ 任何一格抬不起來就整顆回 `null`（誠實降級）——半個集合是錯的集合。
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:liftSet', (node, ctx) => {
    const items: SemanticNode[] = []
    for (const c of node.namedChildren) {
      const lifted = ctx.lift(c)
      if (!lifted) return null
      items.push(lifted)
    }
    if (items.length === 0) return null
    return createNode('python:set_make', {}, { items })
  })
}
