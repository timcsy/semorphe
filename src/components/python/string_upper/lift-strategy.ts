/** `python:string_upper` 的 **lift** 路——認 `x.upper(...)`。 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:lift_string_upper', (node, ctx) => {
    const fn = node.childForFieldName('function')
    if (fn?.type !== 'attribute') return null
    if (fn.childForFieldName('attribute')?.text !== 'upper') return null
    const objNode = fn.childForFieldName('object')
    const obj = objNode ? ctx.lift(objNode) : null
    if (!obj) return null
    const args = node.childForFieldName('arguments')?.namedChildren ?? []
    if (args.length !== 0) return null // 引數數量不同 → 讓一般方法呼叫接手
    
    return createNode('python:string_upper', {}, { obj: [obj] })
  })
}
