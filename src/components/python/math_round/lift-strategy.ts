/** `python:math_round` 的 **lift** 路——認 `round(...)`。 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'
// ⚠️ **裸的產生器算一個引數**——`" ".join(f(x) for x in xs)` 的 `arguments`
//    【就是】那個產生器節點，照 `namedChildren` 數會數到兩個（見那個 helper 的檔頭）
import { pythonCallArgs } from '../../../languages/python/call-args'
import type { SemanticNode } from '../../../core/types'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:lift_math_round', (node, ctx) => {
    if (node.childForFieldName('function')?.text !== 'round') return null
    const args = pythonCallArgs(node)
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
