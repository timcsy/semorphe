/**
 * `python:container_pop` 的 **lift** 路——`xs.pop()` 與 `xs.pop(0)`。
 *
 * ⚠️ **字典也有 `.pop`**，而它的語義不同（按鍵拿走，可帶預設值）——
 * 兩個引數的形狀讓一般方法呼叫接手，**不要把兩件事塞進同一顆積木**。
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'
// ⚠️ **裸的產生器算一個引數**——`" ".join(f(x) for x in xs)` 的 `arguments`
//    【就是】那個產生器節點，照 `namedChildren` 數會數到兩個（見那個 helper 的檔頭）
import { pythonCallArgs } from '../../../languages/python/call-args'
import type { SemanticNode } from '../../../core/types'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:lift_container_pop', (node, ctx) => {
    const fn = node.childForFieldName('function')
    if (fn?.type !== 'attribute') return null
    if (fn.childForFieldName('attribute')?.text !== 'pop') return null
    const objNode = fn.childForFieldName('object')
    const obj = objNode ? ctx.lift(objNode) : null
    if (!obj) return null
    const args = pythonCallArgs(node)
    if (args.length > 1) return null
    const kids: Record<string, SemanticNode[]> = { obj: [obj] }
    if (args.length === 1) {
      const i = ctx.lift(args[0])
      if (!i) return null
      kids['index'] = [i]
    }
    return createNode('python:container_pop', {}, kids)
  })
}
