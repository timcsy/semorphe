/**
 * `cpp:math_min` 的 **lift** 路——**一個帶真邏輯的分支**
 *
 * 原本是 `lifters/io.ts` 的 `if (funcName === 'min' || funcName === 'std::min') { … }`。
 * 它塞不進 `call-concepts` 那張純資料表——判別本身是這顆元件的知識
 * （「`min` 帶這些引數時是我」），不是路由器的知識。
 *
 * > **路由器該知道的是「去問誰」，不是「答案是什麼」。**
 *
 * 回傳 `null` = 「這一段不是我」，路由器繼續問下一個。
 */
import type { SemanticNode } from '../../../core/types'
import { registerCallBranch } from '../../../core/component/lift-branches'
import { createNode } from '../../../core/semantic-tree'

export function registerLift(): void {
  registerCallBranch('cpp/math_min', (funcName, argChildren, ctx, _argsNode): SemanticNode | null => {
    if (!(funcName === 'min' || funcName === 'std::min')) return null
    const a = argChildren[0] ? ctx.lift(argChildren[0]) : null
    const b = argChildren[1] ? ctx.lift(argChildren[1]) : null
    return createNode('cpp:math_min', {}, {
    a: a ? [a] : [],
    b: b ? [b] : [],
    })
  })
}
