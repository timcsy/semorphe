/**
 * `python:container_sort_self` 的 **lift** 路——`xs.sort()`／`xs.sort(key=len, reverse=True)`。
 *
 * ⚠️ **只認得 `key` 與 `reverse` 兩個關鍵字**：別的讓一般方法呼叫接手
 * ——積木上沒有那一格，而產出一個少了引數的呼叫比降級更糟。
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'
// ⚠️ **裸的產生器算一個引數**——`" ".join(f(x) for x in xs)` 的 `arguments`
//    【就是】那個產生器節點，照 `namedChildren` 數會數到兩個（見那個 helper 的檔頭）
import { pythonCallArgs } from '../../../languages/python/call-args'
import type { SemanticNode } from '../../../core/types'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:lift_container_sort_self', (node, ctx) => {
    const fn = node.childForFieldName('function')
    if (fn?.type !== 'attribute') return null
    if (fn.childForFieldName('attribute')?.text !== 'sort') return null
    const objNode = fn.childForFieldName('object')
    const obj = objNode ? ctx.lift(objNode) : null
    if (!obj) return null
    const kids: Record<string, SemanticNode[]> = { obj: [obj] }
    for (const a of pythonCallArgs(node)) {
      // 位置引數：`xs.sort(f)` 不是合法的 Python（那兩個是 keyword-only）
      if (a.type !== 'keyword_argument') return null
      const slot = a.childForFieldName('name')?.text ?? ''
      if (slot !== 'key' && slot !== 'reverse') return null
      const v = a.childForFieldName('value')
      const lifted = v ? ctx.lift(v) : null
      if (!lifted) return null
      kids[slot] = [lifted]
    }
    return createNode('python:container_sort_self', {}, kids)
  })
}
