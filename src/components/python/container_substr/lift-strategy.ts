/**
 * `python:container_substr` 的 **lift** 路。
 *
 * ```
 * subscript [value,subscript]  «xs[1:3]»
 *   identifier «xs»
 *   slice «1:3»      ← 差別只在這裡；取一格時這裡是一個運算式
 * ```
 *
 * ⚠️ `slice` 的兩端**可以沒有**（`xs[:2]`／`xs[-2:]`），而 tree-sitter
 * 用具名子節點表示有的那些——所以**要看冒號的位置**，不能只數子節點。
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:liftSlice', (node, ctx) => {
    const sl = node.childForFieldName('subscript')
    if (sl?.type !== 'slice') return null // 取一格 → 讓下一筆樣式接手
    const objNode = node.childForFieldName('value')
    const obj = objNode ? ctx.lift(objNode) : null
    if (!obj) return null

    // 🔴 **照冒號【分段】，不要數冒號再猜**（2026-08-22）。
    //
    // 原本用 `sl.text.split(':')` 配上「有幾個冒號」來判斷哪個具名子節點是
    // 起點、哪個是終點——而 `s[a:b:c]` 有兩個冒號，於是整顆降級。
    // ⚠️ 更麻煩的是**冒號可能出現在子運算式裡**（`d[k1:k2]` 的鍵是字典時），
    // 那時數出來的數字是錯的。
    //
    // 🟢 走**子節點的順序**：匿名的 `:` 就是分隔符，具名的就是那一段的內容。
    // > **一個靠數分隔符來決定欄位的解析，會在分隔符出現在內容裡的那天說錯話。**
    const segs: (SemanticNode | null)[] = [null, null, null]
    let seg = 0
    for (const c of sl.children) {
      if (!c.isNamed) { seg++; continue }
      if (seg > 2) return null // 三個冒號以上不是合法的切片
      const lifted = ctx.lift(c)
      if (!lifted) return null // 有一段認不出來 → 整顆降級
      segs[seg] = lifted
    }

    const children: Record<string, SemanticNode[]> = { obj: [obj] }
    if (segs[0]) children.from = [segs[0]]
    if (segs[1]) children.to = [segs[1]]
    if (segs[2]) children.step = [segs[2]]
    return createNode('python:container_substr', {}, children)
  })
}
