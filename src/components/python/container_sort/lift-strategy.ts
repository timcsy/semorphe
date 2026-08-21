/**
 * `python:container_sort` 的 **lift** 路——認 `sorted(...)`。
 *
 * 🟢 被呼叫的名字不是 `sorted` 就回 `null`，比對迴圈落到下一筆樣式。
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:lift_container_sort', (node, ctx) => {
    if (node.childForFieldName('function')?.text !== 'sorted') return null
    const args: SemanticNode[] = []
    for (const a of node.childForFieldName('arguments')?.namedChildren ?? []) {
      const lifted = ctx.lift(a)
      // 有一個引數認不出來 → 整顆降級，不產出一個少了引數的呼叫
      if (!lifted) return null
      args.push(lifted)
    }
    if (args.length !== 1) return null
    return createNode('python:container_sort', {}, { obj: args })
  })
}
