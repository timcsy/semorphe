/**
 * `cpp:range_sum_partial` 的 **lift** 路——**一個帶真邏輯的分支**
 *
 * 原本是 `lifters/io.ts` 的 `if (funcName === 'partial_sum' || funcName === 'std::partial_sum') { … }`。
 * 它塞不進 `call-concepts` 那張純資料表——判別本身是這顆元件的知識
 * （「`partial_sum` 帶這些引數時是我」），不是路由器的知識。
 *
 * > **路由器該知道的是「去問誰」，不是「答案是什麼」。**
 *
 * 回傳 `null` = 「這一段不是我」，路由器繼續問下一個。
 */
import type { SemanticNode } from '../../../core/types'
import { registerCallBranch } from '../../../core/component/lift-branches'
import { createNode } from '../../../core/semantic-tree'

export function registerLift(): void {
  registerCallBranch('cpp/range_sum_partial', (funcName, _argChildren, _ctx, argsNode): SemanticNode | null => {
    if (!(funcName === 'partial_sum' || funcName === 'std::partial_sum')) return null
    const psArgs = argsNode ? argsNode.namedChildren : []
    const beginText = psArgs[0]?.text ?? 'v.begin()'
    const endText = psArgs[1]?.text ?? 'v.end()'
    const destText = psArgs[2]?.text ?? 'result.begin()'
    return createNode('cpp:range_sum_partial', { begin: beginText, end: endText, dest: destText }, {})
  })
}
