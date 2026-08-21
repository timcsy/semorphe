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
 * 🟢 **巢狀（好幾個 `for_in_clause`）收得下**（2026-08-22）：最裡面那一段留在
 * 這一顆的 `obj`／`iterable`，其餘**由外而內串成一條 `outer` 鏈**
 * ——每一段是一顆同族的「一段走訪來源」，而它自己也有 `outer`，
 * 所以層數不受限。
 *
 * ⚠️ 在此之前它整顆降級，而那是對的選擇：**收一半會產出一個少了一層迴圈的
 * 合法運算式，而它算出來的東西完全不同。**
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'
import type { SemanticNode } from '../../../core/types'
// ⚠️ **呼叫它的建構子，不要寫下它的身分**——就近性護欄兩個方向都在看。
import { buildLoopIter } from '../loop_iter/build'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:liftArrayMakeFor', (node, ctx) => {
    const fors = node.namedChildren.filter((c) => c.type === 'for_in_clause')
    if (fors.length === 0) return null
    const ifs = node.namedChildren.filter((c) => c.type === 'if_clause')
    if (ifs.length > 1) return null

    const body = node.childForFieldName('body')
    // 🔴 **最裡面那一段留在這一顆**，其餘由外而內串成 `outer` 鏈
    const inner = fors[fors.length - 1]
    const name = inner.childForFieldName('left')
    // 解構的目標（`for k, v in …`）還沒有地方放 → 誠實降級
    if (!body || name?.type !== 'identifier') return null

    // 外面那幾層：由最外開始，一層包一層
    let outer: SemanticNode | null = null
    for (const f of fors.slice(0, -1)) {
      const n = f.childForFieldName('left')
      const r = f.childForFieldName('right')
      const it = r ? ctx.lift(r) : null
      // 有一層認不出來 → 整顆降級，不產出一個少了一層迴圈的推導式
      if (n?.type !== 'identifier' || !it) return null
      outer = buildLoopIter(n.text, it, outer)
    }

    const src = inner.childForFieldName('right')
    const expr = ctx.lift(body)
    const iter = src ? ctx.lift(src) : null
    // `if_clause` 底下的第一個具名子節點就是那個條件
    const condNode = ifs[0]?.namedChildren[0]
    const cond = condNode ? ctx.lift(condNode) : null
    if (!expr || !iter) return null

    return createNode(
      'python:array_make_for',
      { obj: name.text },
      {
        expression: [expr],
        iterable: [iter],
        condition: cond ? [cond] : [],
        ...(outer ? { outer: [outer] } : {}),
      },
    )
  })
}
