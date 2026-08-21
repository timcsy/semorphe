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
    // 🔴 步長（`xs[::2]`，兩個冒號）還沒收——整顆降級，不產出一個少了步長的切片
    if ((sl.text.match(/:/g) ?? []).length !== 1) return null

    const objNode = node.childForFieldName('value')
    const obj = objNode ? ctx.lift(objNode) : null
    if (!obj) return null

    // 冒號在哪，決定那個具名子節點是起點還是終點
    const [before, after] = sl.text.split(':')
    const kids = sl.namedChildren
    let idx = 0
    const from = before.trim() ? ctx.lift(kids[idx++]) : null
    const to = after.trim() ? ctx.lift(kids[idx]) : null

    const children: Record<string, SemanticNode[]> = { obj: [obj] }
    if (from) children.from = [from]
    if (to) children.to = [to]
    return createNode('python:container_substr', {}, children)
  })
}
