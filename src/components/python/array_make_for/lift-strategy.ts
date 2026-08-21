/**
 * `python:array_make_for` 的 **lift** 路。
 *
 * ```
 * list_comprehension [body]  «[x * x for x in range(3) if x > 0]»
 *   binary_operator            ← body：每一格要算什麼
 *   for_in_clause [left,right] ← 名字 ＋ 來源
 *   if_clause                  ← 可選的篩選
 * ```
 *
 * ⚠️ `for_in_clause` 與 `if_clause` 是**兄弟子節點不是欄位**，所以樣式走不到。
 *
 * 🔴 **巢狀（兩個 `for_in_clause`）整顆走誠實降級**——見 `component.json`：
 * 收一半會產出一個少了一層迴圈的合法運算式，而它算出來的東西完全不同。
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:liftArrayMakeFor', (node, ctx) => {
    const fors = node.namedChildren.filter((c) => c.type === 'for_in_clause')
    if (fors.length !== 1) return null
    const ifs = node.namedChildren.filter((c) => c.type === 'if_clause')
    if (ifs.length > 1) return null

    const body = node.childForFieldName('body')
    const name = fors[0].childForFieldName('left')
    // 解構的目標（`for k, v in …`）還沒有地方放 → 誠實降級
    if (!body || name?.type !== 'identifier') return null

    const src = fors[0].childForFieldName('right')
    const expr = ctx.lift(body)
    const iter = src ? ctx.lift(src) : null
    // `if_clause` 底下的第一個具名子節點就是那個條件
    const condNode = ifs[0]?.namedChildren[0]
    const cond = condNode ? ctx.lift(condNode) : null
    if (!expr || !iter) return null

    return createNode(
      'python:array_make_for',
      { obj: name.text },
      { expression: [expr], iterable: [iter], condition: cond ? [cond] : [] },
    )
  })
}
