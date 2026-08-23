/** `python:string_strip` 的 **lift** 路——認 `x.strip(...)`。 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'
// ⚠️ **裸的產生器算一個引數**——`" ".join(f(x) for x in xs)` 的 `arguments`
//    【就是】那個產生器節點，照 `namedChildren` 數會數到兩個（見那個 helper 的檔頭）
import { pythonCallArgs } from '../../../languages/python/call-args'
import type { SemanticNode } from '../../../core/types'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:lift_string_strip', (node, ctx) => {
    const fn = node.childForFieldName('function')
    if (fn?.type !== 'attribute') return null
    if (fn.childForFieldName('attribute')?.text !== 'strip') return null
    const objNode = fn.childForFieldName('object')
    const obj = objNode ? ctx.lift(objNode) : null
    if (!obj) return null
    const args = pythonCallArgs(node)
    // 引數數量不同 → 讓同族的一般方法呼叫接手，**不要產出一個少了引數的呼叫**
    if (!(args.length === 0)) return null
    const kids: Record<string, SemanticNode[]> = { obj: [obj] }
    return createNode('python:string_strip', {}, kids)
  })
}
