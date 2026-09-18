/**
 * `cpp:range_sum_partial` 的 **lift** 路——**一個帶真邏輯的分支**
 *
 * 原本是 `lifters/io.ts` 的 `if (funcName === 'partial_sum' || funcName === 'std::partial_sum') { … }`。
 * 它塞不進 `call-components` 那張純資料表——判別本身是這顆元件的知識
 * （「`partial_sum` 帶這些引數時是我」），不是路由器的知識。
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
  registerCallBranch('cpp/range_sum_partial', (funcName, _argChildren, ctx, argsNode): SemanticNode | null => {
    if (!(funcName === 'partial_sum' || funcName === 'std::partial_sum')) return null
    const psArgs = argsNode ? argsNode.namedChildren : []
    /**
     * 🔴 **兩端是【接點】不是 `.text`**（2026-09-18）——見 `component.json` 的 `_children_why`。
     * ⚠️ 接不出來就**讓開**：猜一個錯的專屬身分比誠實降級更糟。
     */
    const ends = liftRangeEnds(psArgs, ctx)
    if (!ends) return null
    const dest = psArgs[2] ? ctx.lift(psArgs[2]) : null
    if (!dest) return null
    return createNode('cpp:range_sum_partial', {}, { ...ends, dest: [dest] })
  })
}
