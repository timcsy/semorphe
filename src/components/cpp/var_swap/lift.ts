/**
 * `cpp:var_swap` 的 **lift** 路——**一個帶真邏輯的分支**
 *
 * 原本是 `lifters/io.ts` 的 `if (funcName === 'swap' || funcName === 'std::swap') { … }`。
 * 它塞不進 `call-concepts` 那張純資料表——判別本身是這顆元件的知識
 * （「`swap` 帶這些引數時是我」），不是路由器的知識。
 *
 * > **路由器該知道的是「去問誰」，不是「答案是什麼」。**
 *
 * 回傳 `null` = 「這一段不是我」，路由器繼續問下一個。
 */
import type { SemanticNode } from '../../../core/types'
import { registerCallBranch } from '../../../core/component/lift-branches'
import { createNode } from '../../../core/semantic-tree'

export function registerLift(): void {
  registerCallBranch('cpp/var_swap', (funcName, argChildren, ctx, _argsNode): SemanticNode | null => {
    if (!(funcName === 'swap' || funcName === 'std::swap')) return null
    // ⚠️ **兩個運算元是運算式，不是名字**：`swap(a[j], a[j+1])` 的
    // `a[j]` 原本被當成一個變數名記進屬性，於是執行時查一個叫 `a[j]` 的變數。
    const left = argChildren[0] ? ctx.lift(argChildren[0]) : null
    const right = argChildren[1] ? ctx.lift(argChildren[1]) : null
    if (!left || !right) return null
    return createNode('cpp:var_swap', {}, { left: [left], right: [right] })
  })
}
