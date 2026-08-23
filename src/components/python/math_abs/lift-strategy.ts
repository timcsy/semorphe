/**
 * `python:math_abs` 的 **lift** 路——認 `abs(...)`。
 *
 * 🟢 被呼叫的名字不是 `abs` 就回 `null`，比對迴圈落到下一筆樣式。
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'
// ⚠️ **裸的產生器算一個引數**——`" ".join(f(x) for x in xs)` 的 `arguments`
//    【就是】那個產生器節點，照 `namedChildren` 數會數到兩個（見那個 helper 的檔頭）
import { pythonCallArgs } from '../../../languages/python/call-args'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:lift_math_abs', (node, ctx) => {
    if (node.childForFieldName('function')?.text !== 'abs') return null
    const args: SemanticNode[] = []
    for (const a of pythonCallArgs(node)) {
      const lifted = ctx.lift(a)
      // 有一個引數認不出來 → 整顆降級，不產出一個少了引數的呼叫
      if (!lifted) return null
      args.push(lifted)
    }
    if (args.length !== 1) return null
    return createNode('python:math_abs', {}, { value: args })
  })
}
