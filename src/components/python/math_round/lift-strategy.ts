/** `python:math_round` 的 **lift** 路——認 `round(...)`。 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'
import type { SemanticNode } from '../../../core/types'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:lift_math_round', (node, ctx) => {
    if (node.childForFieldName('function')?.text !== 'round') return null
    const args = node.childForFieldName('arguments')?.namedChildren ?? []
    // 引數數量不同 → 讓一般呼叫接手，**不要產出一個少了引數的呼叫**
    if (!(args.length === 1 || args.length === 2)) return null
    const kids: Record<string, SemanticNode[]> = {}
    if (args.length > 0) {
      const v0 = ctx.lift(args[0]); if (!v0) return null
      kids['value'] = [v0]
    }
    if (args.length > 1) {
      const v1 = ctx.lift(args[1]); if (!v1) return null
      kids['digits'] = [v1]
    }
    return createNode('python:math_round', {}, kids)
  })
}
