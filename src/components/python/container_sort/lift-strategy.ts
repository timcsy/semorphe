/**
 * `python:container_sort` 的 **lift** 路——認 `sorted(...)`。
 *
 * 🟢 被呼叫的名字不是 `sorted` 就回 `null`，比對迴圈落到下一筆樣式。
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'
// ⚠️ 裸的產生器算**一個**引數——見那個 helper 的檔頭
import { pythonCallArgs } from '../../../languages/python/call-args'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:lift_container_sort', (node, ctx) => {
    if (node.childForFieldName('function')?.text !== 'sorted') return null
    const raw = pythonCallArgs(node)
    // 🟢 **`key=` 與 `reverse=` 收得下**（2026-08-22）：它們是 `keyword_argument`，
    //    而 `sorted(w, key=len)` 比裸的 `sorted(xs)` 還常見。
    const kids: Record<string, SemanticNode[]> = {}
    for (const a of raw) {
      if (a.type === 'keyword_argument') {
        const slot = a.childForFieldName('name')?.text ?? ''
        if (slot !== 'key' && slot !== 'reverse') return null // 別的關鍵字 → 讓一般呼叫接手
        const v = a.childForFieldName('value')
        const lifted = v ? ctx.lift(v) : null
        if (!lifted) return null
        kids[slot] = [lifted]
        continue
      }
      if (kids['obj']) return null // 兩個位置引數 → 不是我們認得的形狀
      const lifted = ctx.lift(a)
      // 有一個引數認不出來 → 整顆降級，不產出一個少了引數的呼叫
      if (!lifted) return null
      kids['obj'] = [lifted]
    }
    if (!kids['obj']) return null
    return createNode('python:container_sort', {}, kids)
  })
}
