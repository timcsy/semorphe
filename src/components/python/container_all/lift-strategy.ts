/**
 * `python:container_all` 的 **lift** 路——認 `all(…)`。
 *
 * ⚠️ **引數數量不合就讓路**：交給一般呼叫接手，**不要產出一個少了引數的呼叫**。
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'
import { pythonCallArgs } from '../../../languages/python/call-args'
import type { SemanticNode } from '../../../core/types'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:lift_container_all', (node, ctx) => {
    if (node.childForFieldName('function')?.text !== 'all') return null
    // ⚠️ 裸的產生器算**一個**引數——見那個 helper 的檔頭
    const args = pythonCallArgs(node)
    if (args.length !== 1) return null
    const kids: Record<string, SemanticNode[]> = {}
    const a0 = ctx.lift(args[0])
    if (!a0) return null
    kids['obj'] = [a0]
    return createNode('python:container_all', {}, kids)
  })
}
