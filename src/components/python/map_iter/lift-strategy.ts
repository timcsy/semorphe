/** `python:map_iter` 的 **lift** 路——認 `x.items／keys／values(...)`。 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'
import type { SemanticNode } from '../../../core/types'

const KINDS = new Set(["items", "keys", "values"])

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:lift_map_iter', (node, ctx) => {
    const fn = node.childForFieldName('function')
    if (fn?.type !== 'attribute') return null
    const m = fn.childForFieldName('attribute')?.text ?? ''
    if (!KINDS.has(m)) return null
    const objNode = fn.childForFieldName('object')
    const obj = objNode ? ctx.lift(objNode) : null
    if (!obj) return null
    const args = node.childForFieldName('arguments')?.namedChildren ?? []
    // 引數數量不同 → 讓同族的一般方法呼叫接手，**不要產出一個少了引數的呼叫**
    if (!(args.length === 0)) return null
    const kids: Record<string, SemanticNode[]> = { obj: [obj] }
    return createNode('python:map_iter', { kind: m }, kids)
  })
}
