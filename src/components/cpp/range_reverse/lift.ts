/**
 * `cpp:range_reverse` 的 **lift** 路——**一個帶真邏輯的分支**
 *
 * 判別本身是這顆元件的知識（引數個數／函式名的多種寫法），不是路由器的知識。
 * 回傳 `null` = 「這一段不是我」，路由器繼續問下一個。
 */
import type { SemanticNode } from '../../../core/types'
import { registerCallBranch } from '../../../core/component/lift-branches'
import { createNode } from '../../../core/semantic-tree'

export function registerLift(): void {
  registerCallBranch('cpp/range_reverse', (funcName, argChildren, _ctx, _argsNode): SemanticNode | null => {
    if (!((funcName === 'reverse' || funcName === 'std::reverse') && argChildren.length === 2)) return null
    const beginText = argChildren[0]?.text ?? 'v.begin()'
    const endText = argChildren[1]?.text ?? 'v.end()'
    return createNode('cpp:range_reverse', { begin: beginText, end: endText })
  })
}
