/**
 * `python:compare_chain` 的 **lift** 路——`0 < x < 10`。
 *
 * ⚠️ tree-sitter 的 `comparison_operator` **沒有 left／right 欄位**：
 * 運算元是位置式的具名子節點，而運算子在 `operators` 這個**可以重複的**欄位裡。
 *
 * 🔴 **只收兩段**（`a < b < c`）。**三段以上主動變灰**——積木上只有兩個下拉。
 *
 * ⚠️ **主動**是關鍵：回 `null` 的話比對迴圈會落到同族的一般比較，
 * 而那一筆只讀前兩個運算元——`1 < x < 10 < z` 會**安靜地**變成 `1 < x`。
 * 那正是這顆元件被做出來的原因（`0 < x < 10` 曾經產出 `0 < x`，
 * 而它**碰巧算出同一個答案**）。
 *
 * > **當一個「我做不到」會被別人接手成「我做到了一半」，
 * > 那個「做不到」就必須自己說出來。**
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'
// ⚠️ **呼叫它的建構子，不要寫下它的身分**——就近性護欄兩個方向都在看。
import { buildRawExpression } from '../raw_expression/build'

/** 與同族一般比較的 `routes` 同一份清單——**沒列到的運算子不歸我們**。 */
const ROUTED = new Set(['<', '>', '<=', '>=', '==', '!='])

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:lift_compare_chain', (node, ctx) => {
    const operands = node.namedChildren
    if (operands.length < 3) return null // 兩個運算元＝一般的比較，不歸這裡
    // ⚠️ `AstNode` 的介面上只有單數的 `childForFieldName`——而運算子這個欄位
    //    **可以重複**。`children` 裡的**匿名**節點就是那些運算子。
    //
    // 🔴 **要用 `isNamed` 判，不可以拿 `namedChildren` 去做集合差集**：
    //    每次存取都會產生**新的包裝物件**，於是 `Set.has` 永遠是 false
    //    ——症狀是這個策略靜靜回 `null`，而一般比較把後半段砍掉。
    const ops = node.children.filter((c) => !c.isNamed).map((c) => c.text)
    if (!ops.every((o) => ROUTED.has(o))) return null
    // 🔴 三段以上：**主動變灰**，見檔頭
    if (operands.length > 3 || ops.length !== 2) {
      return buildRawExpression(node.text)
    }
    const lifted = operands.map((o) => ctx.lift(o))
    // 有一格認不出來 → 整顆降級，不產出一個少了運算元的比較
    if (lifted.some((x) => !x)) return null
    return createNode(
      'python:compare_chain',
      { operator: ops[0], operator2: ops[1] },
      { left: [lifted[0]!], middle: [lifted[1]!], right: [lifted[2]!] },
    )
  })
}
