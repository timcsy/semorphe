/**
 * `python:set_append` 的 **lift** 路——認 `x.add(…)`。
 *
 * ⚠️ **引數數量不合就讓路**：多一個或少一個都交給一般方法呼叫接手，
 * **不要產出一個少了引數的呼叫**。
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'
import type { SemanticNode } from '../../../core/types'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:lift_set_append', (node, ctx) => {
    const fn = node.childForFieldName('function')
    if (fn?.type !== 'attribute') return null
    if (fn.childForFieldName('attribute')?.text !== 'add') return null
    const objNode = fn.childForFieldName('object')
    const obj = objNode ? ctx.lift(objNode) : null
    if (!obj) return null
    const args = node.childForFieldName('arguments')?.namedChildren ?? []
    if (args.length !== 1) return null
    const kids: Record<string, SemanticNode[]> = { obj: [obj] }
    if (args.length > 0) {
      const a0 = ctx.lift(args[0])
      if (!a0) return null
      kids['value'] = [a0]
    }
    return createNode('python:set_append', {}, kids)
  })
}
