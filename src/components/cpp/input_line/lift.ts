/**
 * `cpp:input_line` 的 **lift** 路——**一個帶真邏輯的分支**
 *
 * 原本是 `lifters/io.ts` 的 `if (funcName === 'getline' && argChildren.length >= 2) { … }`。
 * 它塞不進 `call-components` 那張純資料表——判別本身是這顆元件的知識
 * （「`getline` 帶這些引數時是我」），不是路由器的知識。
 *
 * > **路由器該知道的是「去問誰」，不是「答案是什麼」。**
 *
 * 回傳 `null` = 「這一段不是我」，路由器繼續問下一個。
 */
import type { SemanticNode } from '../../../core/types'
import { registerCallBranch } from '../../../core/component/lift-branches'
import { createNode } from '../../../core/semantic-tree'

export function registerLift(): void {
  registerCallBranch('cpp/input_line', (funcName, argChildren, ctx, _argsNode): SemanticNode | null => {
    if (!(funcName === 'getline' && argChildren.length >= 2)) return null
    // 🟢 **第二個引數就 lift**（2026-08-25）——`getline(cin, o.name)` 合法，
    //    而在此之前它被 `.text` 抄成字串。見 `knowledge/concepts/左值.md`。
    const targetNode = argChildren[1]
    const target = targetNode ? ctx.lift(targetNode) : null
    return createNode('cpp:input_line', {}, { target: target ? [target] : [] })
  })
}
