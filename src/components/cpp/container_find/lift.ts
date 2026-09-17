/**
 * `cpp:container_find` 的 **lift** 路——**一個帶真邏輯的分支**
 *
 * ## 🔴 為什麼不能用那張純資料的方法表
 *
 * 兩個理由，而第二個是硬的：
 *
 * ① 三個方法名對同一顆身分，差別要進 `how` 屬性——那張表只放得下「名字 → 身分」。
 * ② 🔴 **`find` 這個方法名已經有主人了**：字串的搜尋。
 *    而 `s.find(x)` 在集合上與在字串上是**兩個語義**（一個回位置、一個回索引）。
 *
 * ## ⚠️ 所以判準是接收者的型別，而「我有沒有這個方法」由容器自己宣告
 *
 * 這裡**不列**一張「哪些型別有成員 find」的清單——那張清單會在下一個容器
 * 加進來的那天過期，而過期的症狀是**那個容器的 `find` 被字串搜尋認走**。
 *
 * > **「我有沒有這個方法」是容器自己的事實，不是查找那顆該猜的。**
 *
 * ⚠️ 而**查不到型別時說「不是我」**——與同族那顆取端點的元件相反，
 * 它在查不到時照舊認。差別的理由：`begin()` 幾乎只有容器有，而 `find`
 * **字串也有，而且更常見**。
 * > **一個方法名被兩族共用時，查不到型別就該讓給比較常見的那一族。**
 */
import type { SemanticNode } from '../../../core/types'
import { registerMethodBranch } from '../../../core/component/lift-branches'
import { componentForContainerTemplate } from '../../../core/component/container-templates'
import { componentTraits } from '../../../core/component/traits'
import { createNode } from '../../../core/semantic-tree'

/** 這顆認得的三個方法名——與積木上那格下拉同一份。 */
const HOWS = new Set(['find', 'lower_bound', 'upper_bound'])

export function registerLift(): void {
  registerMethodBranch('cpp/container_find', (obj, method, argChildren, ctx): SemanticNode | null => {
    if (!HOWS.has(method)) return null
    // 這三個都**恰好吃一個引數**。判不出來就說不是我。
    if (argChildren.length !== 1) return null
    if (!obj) return null
    const type = ctx.data.getType(obj)
    if (!type) return null
    const id = componentForContainerTemplate(type)
    if (!id || componentTraits(id)?.associative !== true) return null
    // ⚠️ `argChildren` 是 **AST 節點**，不是語義節點——要自己 lift 一次。
    const key = ctx.lift(argChildren[0])
    if (!key) return null
    return createNode('cpp:container_find', { obj, how: method }, { key: [key] })
  })
}
