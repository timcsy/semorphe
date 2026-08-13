/**
 * `cpp:range_find_lower` 的 **lift** 路——**一個帶真邏輯的分支**
 *
 * 判別是這顆元件的知識（`lower_bound` 或 `std::lower_bound`，而且要 3 個引數），不是路由器的知識。
 * 回傳 `null` = 「這一段不是我」。
 */
import type { SemanticNode } from '../../../core/types'
import { registerCallBranch } from '../../../core/component/lift-branches'
import { createNode } from '../../../core/semantic-tree'

const NAMES = new Set(["lower_bound", "std::lower_bound"])

export function registerLift(): void {
  registerCallBranch('cpp/range_find_lower', (funcName, _argChildren, ctx, argsNode): SemanticNode | null => {
    if (!NAMES.has(funcName)) return null
    const args = argsNode ? argsNode.namedChildren : []
    // 引數個數不對就**不是我**——猜的話會產出一個引數掉了的節點，
    // 而那在產生器那一路看起來完全正常。
    if (args.length !== 3) return null
    const beginText = args[0]?.text ?? 'v.begin()'
    const endText = args[1]?.text ?? 'v.end()'
    const valueChild = args[2] ? ctx.lift(args[2]) : null
    return createNode('cpp:range_find_lower', { begin: beginText, end: endText }, {
      value: valueChild ? [valueChild] : [],
    })
  })
}
