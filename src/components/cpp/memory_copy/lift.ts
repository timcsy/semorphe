/**
 * `cpp:memory_copy` 的 **lift** 路——**一個帶真邏輯的分支**
 *
 * 原本是 `lifters/io.ts` 的 `if (funcName === 'memcpy' && argChildren.length === 3) { … }`。
 * 它塞不進 `call-components` 那張純資料表——判別本身是這顆元件的知識
 * （「`memcpy` 帶這些引數時是我」），不是路由器的知識。
 *
 * > **路由器該知道的是「去問誰」，不是「答案是什麼」。**
 *
 * 回傳 `null` = 「這一段不是我」，路由器繼續問下一個。
 */
import type { SemanticNode } from '../../../core/types'
import { registerCallBranch } from '../../../core/component/lift-branches'
import { createNode } from '../../../core/semantic-tree'

export function registerLift(): void {
  registerCallBranch('cpp/memory_copy', (funcName, argChildren, ctx, _argsNode): SemanticNode | null => {
    if (!(funcName === 'memcpy' && argChildren.length === 3)) return null
    const dest = argChildren[0] ? ctx.lift(argChildren[0]) : null
    const src = argChildren[1] ? ctx.lift(argChildren[1]) : null
    const size = argChildren[2] ? ctx.lift(argChildren[2]) : null
    return createNode('cpp:memory_copy', {}, { dest: dest ? [dest] : [], src: src ? [src] : [], size: size ? [size] : [] })
  })
}
