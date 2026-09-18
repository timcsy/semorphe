/**
 * `cpp:range_sum` 的 **lift** 路——**一個帶真邏輯的分支**
 *
 * 原本是 `lifters/io.ts` 的 `if (funcName === 'accumulate' || funcName === 'std::accumulate') { … }`。
 * 它塞不進 `call-components` 那張純資料表——判別本身是這顆元件的知識
 * （「`accumulate` 帶這些引數時是我」），不是路由器的知識。
 *
 * > **路由器該知道的是「去問誰」，不是「答案是什麼」。**
 *
 * 回傳 `null` = 「這一段不是我」，路由器繼續問下一個。
 */
import type { SemanticNode } from '../../../core/types'
import { registerCallBranch } from '../../../core/component/lift-branches'
import { createNode } from '../../../core/semantic-tree'
import { liftRangeEnds } from '../../../languages/cpp/lang/runtime/range-lift'

export function registerLift(): void {
  registerCallBranch('cpp/range_sum', (funcName, _argChildren, ctx, argsNode): SemanticNode | null => {
    if (!(funcName === 'accumulate' || funcName === 'std::accumulate')) return null
    const accumArgs = argsNode ? argsNode.namedChildren : []
    /**
     * 🔴 **兩端是【接點】不是 `.text`**（2026-09-18）——見 `component.json` 的 `_children_why`。
     * ⚠️ 接不出來就**讓開**：猜一個錯的專屬身分比誠實降級更糟。
     */
    const ends = liftRangeEnds(accumArgs, ctx)
    if (!ends) return null
    const initChild = accumArgs[2] ? ctx.lift(accumArgs[2]) : null
    return createNode('cpp:range_sum', {}, {
    ...ends,
    init: initChild ? [initChild] : [],
    })
  })
}
