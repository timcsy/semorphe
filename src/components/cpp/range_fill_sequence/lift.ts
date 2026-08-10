/**
 * `cpp:range_fill_sequence` 的 **lift** 路——**一個帶真邏輯的分支**
 *
 * 原本是 `lifters/io.ts` 的 `if (funcName === 'iota' || funcName === 'std::iota') { … }`。
 * 它塞不進 `call-concepts` 那張純資料表——判別本身是這顆元件的知識
 * （「`iota` 帶這些引數時是我」），不是路由器的知識。
 *
 * > **路由器該知道的是「去問誰」，不是「答案是什麼」。**
 *
 * 回傳 `null` = 「這一段不是我」，路由器繼續問下一個。
 */
import type { SemanticNode } from '../../../core/types'
import { registerCallBranch } from '../../../core/component/lift-branches'
import { createNode } from '../../../core/semantic-tree'

export function registerLift(): void {
  registerCallBranch('cpp/range_fill_sequence', (funcName, _argChildren, ctx, argsNode): SemanticNode | null => {
    if (!(funcName === 'iota' || funcName === 'std::iota')) return null
    const iotaArgs = argsNode ? argsNode.namedChildren : []
    const beginText = iotaArgs[0]?.text ?? 'v.begin()'
    const endText = iotaArgs[1]?.text ?? 'v.end()'
    const valueChild = iotaArgs[2] ? ctx.lift(iotaArgs[2]) : null
    return createNode('cpp:range_fill_sequence', { begin: beginText, end: endText }, {
    value: valueChild ? [valueChild] : [],
    })
  })
}
