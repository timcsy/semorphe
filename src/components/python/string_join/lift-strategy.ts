/** `python:string_join` 的 **lift** 路——認 `x.join(...)`。 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'
import type { SemanticNode } from '../../../core/types'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:lift_string_join', (node, ctx) => {
    const fn = node.childForFieldName('function')
    if (fn?.type !== 'attribute') return null
    if (fn.childForFieldName('attribute')?.text !== 'join') return null
    const objNode = fn.childForFieldName('object')
    const obj = objNode ? ctx.lift(objNode) : null
    if (!obj) return null
    const args = node.childForFieldName('arguments')?.namedChildren ?? []
    // 引數數量不同 → 讓同族的一般方法呼叫接手，**不要產出一個少了引數的呼叫**
    if (!(args.length === 1)) return null
    const kids: Record<string, SemanticNode[]> = { obj: [obj] }
    if (args.length > 0) {
      const v0 = ctx.lift(args[0]); if (!v0) return null
      kids['value'] = [v0]
    }
    return createNode('python:string_join', {}, kids)
  })
}
