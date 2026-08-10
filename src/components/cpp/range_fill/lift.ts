/**
 * `cpp:range_fill` 的 **lift** 路——**一個帶真邏輯的分支**
 *
 * 判別本身是這顆元件的知識（引數個數／函式名的多種寫法），不是路由器的知識。
 * 回傳 `null` = 「這一段不是我」，路由器繼續問下一個。
 */
import type { SemanticNode } from '../../../core/types'
import { registerCallBranch } from '../../../core/component/lift-branches'
import { createNode } from '../../../core/semantic-tree'

export function registerLift(): void {
  registerCallBranch('cpp/range_fill', (funcName, argChildren, ctx, _argsNode): SemanticNode | null => {
    if (!((funcName === 'fill' || funcName === 'std::fill') && argChildren.length === 3)) return null
    const beginText = argChildren[0]?.text ?? 'v.begin()'
    const endText = argChildren[1]?.text ?? 'v.end()'
    const valueChild = argChildren[2] ? ctx.lift(argChildren[2]) : null
    return createNode('cpp:range_fill', { begin: beginText, end: endText }, {
    value: valueChild ? [valueChild] : [],
    })
  })
}
