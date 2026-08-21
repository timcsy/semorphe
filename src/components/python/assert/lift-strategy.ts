/** `python:assert` 的 **lift** 路——`assert x > 0` 與 `assert x > 0, "訊息"`。 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:lift_assert', (node, ctx) => {
    const parts = node.namedChildren
    if (parts.length < 1 || parts.length > 2) return null
    const cond = ctx.lift(parts[0])
    if (!cond) return null
    const kids: Record<string, SemanticNode[]> = { condition: [cond] }
    if (parts.length === 2) {
      const msg = ctx.lift(parts[1])
      if (!msg) return null // 訊息認不出來 → 整顆降級，不產出一個少了訊息的斷言
      kids['value'] = [msg]
    }
    return createNode('python:assert', {}, kids)
  })
}
