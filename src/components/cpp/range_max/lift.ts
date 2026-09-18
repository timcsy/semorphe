/**
 * `cpp:range_max` 的 **lift** 路——**一個帶真邏輯的分支**
 *
 * 判別是這顆元件的知識（`max_element` 或 `std::max_element`，而且要 2 個引數），不是路由器的知識。
 * 回傳 `null` = 「這一段不是我」。
 */
import type { SemanticNode } from '../../../core/types'
import { registerCallBranch } from '../../../core/component/lift-branches'
import { createNode } from '../../../core/semantic-tree'
import { liftRangeEnds } from '../../../languages/cpp/lang/runtime/range-lift'

const NAMES = new Set(["max_element", "std::max_element"])

export function registerLift(): void {
  registerCallBranch('cpp/range_max', (funcName, _argChildren, ctx, argsNode): SemanticNode | null => {
    if (!NAMES.has(funcName)) return null
    const args = argsNode ? argsNode.namedChildren : []
    // 引數個數不對就**不是我**——猜的話會產出一個引數掉了的節點，
    // 而那在產生器那一路看起來完全正常。
    if (args.length !== 2) return null
    /**
     * 🔴 **兩端是【接點】不是 `.text`**（2026-09-18）——見 `component.json` 的 `_children_why`。
     * ⚠️ 接不出來就**讓開**：猜一個錯的專屬身分比誠實降級更糟。
     */
    const ends = liftRangeEnds(args, ctx)
    if (!ends) return null
    return createNode('cpp:range_max', {}, ends)
  })
}
