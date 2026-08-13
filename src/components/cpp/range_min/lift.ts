/**
 * `cpp:range_min` 的 **lift** 路——**一個帶真邏輯的分支**
 *
 * 判別是這顆元件的知識（`min_element` 或 `std::min_element`，而且要 2 個引數），不是路由器的知識。
 * 回傳 `null` = 「這一段不是我」。
 */
import type { SemanticNode } from '../../../core/types'
import { registerCallBranch } from '../../../core/component/lift-branches'
import { createNode } from '../../../core/semantic-tree'

const NAMES = new Set(["min_element", "std::min_element"])

export function registerLift(): void {
  registerCallBranch('cpp/range_min', (funcName, _argChildren, _ctx, argsNode): SemanticNode | null => {
    if (!NAMES.has(funcName)) return null
    const args = argsNode ? argsNode.namedChildren : []
    // 引數個數不對就**不是我**——猜的話會產出一個引數掉了的節點，
    // 而那在產生器那一路看起來完全正常。
    if (args.length !== 2) return null
    const beginText = args[0]?.text ?? 'v.begin()'
    const endText = args[1]?.text ?? 'v.end()'
    return createNode('cpp:range_min', { begin: beginText, end: endText })
  })
}
