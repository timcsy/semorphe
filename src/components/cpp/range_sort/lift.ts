/**
 * `cpp:range_sort` 的 **lift** 路——**一個帶真邏輯的分支**
 *
 * 判別本身是這顆元件的知識（函式名的多種寫法、引數個數），不是路由器的知識。
 * 回傳 `null` = 「這一段不是我」，路由器繼續問下一個。
 *
 * ⚠️ **兩個引數與三個引數是同一顆身分**——第三個是比較器，而
 * 「按什麼順序」是**參數不是身分**（與 `container_push` 把容器種類當參數同形）。
 */
import type { SemanticNode } from '../../../core/types'
import { registerCallBranch } from '../../../core/component/lift-branches'
import { createNode } from '../../../core/semantic-tree'
import { liftRangeEnds } from '../../../languages/cpp/lang/runtime/range-lift'

export function registerLift(): void {
  registerCallBranch('cpp/range_sort', (funcName, argChildren, ctx, _argsNode): SemanticNode | null => {
    if (funcName !== 'sort' && funcName !== 'std::sort' && funcName !== 'stable_sort' && funcName !== 'std::stable_sort') {
      return null
    }
    if (argChildren.length !== 2 && argChildren.length !== 3) return null
    /**
     * 🔴 **兩端是【接點】不是 `.text`**（2026-09-18）。
     *
     * 在此之前這裡抄的是 `argChildren[0].text`——原始碼的一段文字
     * ——而執行期再用 regex 把它解析回來。學生真的寫的 `begin(a)`、
     * `d2[i].begin()`、`d2[0]` 三種形狀全部解析不了。
     * ⚠️ 接不出來就**讓開**：猜一個錯的專屬身分比誠實降級更糟。
     */
    const ends = liftRangeEnds(argChildren, ctx)
    if (!ends) return null
    const cmp = argChildren[2] ? ctx.lift(argChildren[2]) : null
    return createNode('cpp:range_sort', {}, cmp ? { ...ends, comparator: [cmp] } : ends)
  })
}
