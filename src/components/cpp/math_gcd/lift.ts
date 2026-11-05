/**
 * `cpp:math_gcd` 的 **lift** 路——**一個帶真邏輯的分支**
 *
 * 原本是 `lifters/io.ts` 的 `if (funcName === '__gcd' || funcName === 'gcd' || funcName === 'std::gcd') { … }`。
 * 它塞不進 `call-components` 那張純資料表——判別本身是這顆元件的知識
 * （「`__gcd` 帶這些引數時是我」），不是路由器的知識。
 *
 * > **路由器該知道的是「去問誰」，不是「答案是什麼」。**
 *
 * 回傳 `null` = 「這一段不是我」，路由器繼續問下一個。
 */
import type { SemanticNode } from '../../../core/types'
import { registerCallBranch } from '../../../core/component/lift-branches'
import { createNode } from '../../../core/semantic-tree'

export function registerLift(): void {
  registerCallBranch('cpp/math_gcd', (funcName, argChildren, ctx, _argsNode): SemanticNode | null => {
    // 🔴 只認 `__gcd`（2026-11-06，元件管線 311 的盲測）：`gcd`／`std::gcd` 原本也收進來，產碼一律寫回 `__gcd`——改了學生寫的字，
    //    而兩者意思不同（負數時 std::gcd 取絕對值、__gcd 可能是負的），libc++ 上 `__gcd(long long, …)` 還編不過。
    //    它們留給一般的函式呼叫（原字照產）；要有積木的話另立形態或屬性（路線圖）。
    if (funcName !== '__gcd') return null
    const a = argChildren[0] ? ctx.lift(argChildren[0]) : null
    const b = argChildren[1] ? ctx.lift(argChildren[1]) : null
    return createNode('cpp:math_gcd', {}, { a: a ? [a] : [], b: b ? [b] : [] })
  })
}
