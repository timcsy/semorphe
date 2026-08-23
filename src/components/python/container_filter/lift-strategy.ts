/**
 * `python:container_filter` 的 **lift** 路——認 `filter(…)`。
 *
 * ⚠️ **引數數量不合就讓路**：交給一般呼叫接手，**不要產出一個少了引數的呼叫**。
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'
import { pythonCallArgs } from '../../../languages/python/call-args'
import type { SemanticNode } from '../../../core/types'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:lift_container_filter', (node, ctx) => {
    if (node.childForFieldName('function')?.text !== 'filter') return null
    // ⚠️ 裸的產生器算**一個**引數——見那個 helper 的檔頭
    const args = pythonCallArgs(node)
    if (args.length !== 2) return null
    const kids: Record<string, SemanticNode[]> = {}
    const a0 = ctx.lift(args[0])
    if (!a0) return null
    kids['func'] = [a0]
    const a1 = ctx.lift(args[1])
    if (!a1) return null
    kids['obj'] = [a1]
    return createNode('python:container_filter', {}, kids)
  })
}
