/**
 * `cpp:pair_make` 的 **lift** 路——**一個帶真邏輯的分支**
 *
 * 原本是 `lifters/io.ts` 的 `if (funcName === 'make_pair' || funcName === 'std::make_pair') { … }`。
 * 它塞不進 `call-components` 那張純資料表——判別本身是這顆元件的知識
 * （「`make_pair` 帶這些引數時是我」），不是路由器的知識。
 *
 * > **路由器該知道的是「去問誰」，不是「答案是什麼」。**
 *
 * 回傳 `null` = 「這一段不是我」，路由器繼續問下一個。
 */
import type { SemanticNode } from '../../../core/types'
import { registerCallBranch } from '../../../core/component/lift-branches'
import { createNode } from '../../../core/semantic-tree'

export function registerLift(): void {
  registerCallBranch('cpp/pair_make', (funcName, _argChildren, ctx, argsNode): SemanticNode | null => {
    /**
     * 🔴 **建構子形式也是「造一對值」**（2026-09-17，盲測抓到）：
     *
     * ```cpp
     * pair<int,int>(3, 4)              我們：沒有這個函式
     * typedef pair<int,int> P;  P(3,4) 我們：沒有這個函式：P
     * pair<int,int> p(3, 4);           我們：靜默給 (0, 0)   ← 最糟的那一個
     * ```
     *
     * ⚠️ 別名要問**脈絡**（`typedef` 現在會登記 `P → pair<int,int>`），
     *    而不是在這裡列一張「常見的 pair 別名」清單——那張清單第一天就過期。
     */
    const bare = funcName.replace(/^std::/, '')
    const named = bare.includes('<') ? bare.slice(0, bare.indexOf('<')) : bare
    const viaAlias = ctx.data.getType(bare) ?? ''
    const isPairCtor = named === 'pair' ||
      viaAlias.replace(/^std::/, '').startsWith('pair')
    if (!(funcName === 'make_pair' || funcName === 'std::make_pair' || isPairCtor)) return null
    const pairArgs = argsNode ? argsNode.namedChildren : []
    const firstChild = pairArgs[0] ? ctx.lift(pairArgs[0]) : null
    const secondChild = pairArgs[1] ? ctx.lift(pairArgs[1]) : null
    return createNode('cpp:pair_make', {}, {
    first: firstChild ? [firstChild] : [],
    second: secondChild ? [secondChild] : [],
    })
  })
}
