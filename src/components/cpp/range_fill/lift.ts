/**
 * `cpp:range_fill` 的 **lift** 路——**一個帶真邏輯的分支**
 *
 * 判別本身是這顆元件的知識（引數個數／函式名的多種寫法），不是路由器的知識。
 * 回傳 `null` = 「這一段不是我」，路由器繼續問下一個。
 */
import type { SemanticNode } from '../../../core/types'
import { registerCallBranch } from '../../../core/component/lift-branches'
import { createNode } from '../../../core/semantic-tree'
import { liftRangeEnds } from '../../../languages/cpp/lang/runtime/range-lift'

export function registerLift(): void {
  registerCallBranch('cpp/range_fill', (funcName, argChildren, ctx, _argsNode): SemanticNode | null => {
    if (!((funcName === 'fill' || funcName === 'std::fill') && argChildren.length === 3)) return null
    /**
     * 🔴 **兩端是【接點】不是 `.text`**（2026-09-18）——見 `component.json` 的 `_children_why`。
     * ⚠️ 接不出來就**讓開**：猜一個錯的專屬身分比誠實降級更糟。
     */
    const ends = liftRangeEnds(argChildren, ctx)
    if (!ends) return null
    const valueChild = argChildren[2] ? ctx.lift(argChildren[2]) : null
    return createNode('cpp:range_fill', {}, {
    ...ends,
    value: valueChild ? [valueChild] : [],
    })
  })
}
