/**
 * `cpp:string_erase` 的 **lift** 路——**一個帶真邏輯的分支**
 *
 * 判別本身是這顆元件的知識（引數個數／函式名的多種寫法），不是路由器的知識。
 * 回傳 `null` = 「這一段不是我」，路由器繼續問下一個。
 */
import type { SemanticNode } from '../../../core/types'
import { registerMethodBranch } from '../../../core/component/lift-branches'
import { createNode } from '../../../core/semantic-tree'

export function registerLift(): void {
  registerMethodBranch('cpp/string_erase', (obj, method, argChildren, ctx, objNode): SemanticNode | null => {
    if (method !== 'erase') return null
    /**
     * 🔴 **兩個引數不足以認定「這是字串」**（2026-09-18，盲測抓到）。
     *
     * `ms.erase(a, b)` 是**兩個位置界定一段範圍**的容器刪除，而這條分支
     * 只看引數個數就認領了它——於是那個 multiset 被當成字串重建：
     * 內容變成 `[object Object],…`，`before - after` 算出 **-358**。
     *
     * > **一個只看引數個數的判別，在另一個型別剛好也收兩個引數時
     * > 不會落空——它會安靜地把那個東西當成自己的。**
     *
     * 🟢 判準與同族一致：**問接收者的宣告型別**（脈絡查得到）。
     * ⚠️ 查不到就讓開——猜一個錯的專屬身分比誠實降級更糟。
     */
    const t = obj ? ctx.data.getType(obj) : null
    if (t !== 'string') return null
    // 🔴 **接收者是一棵樹**（2026-09-18）——`parts[i].erase(…)`
    const recv = objNode ? ctx.lift(objNode) : null
    if (!recv) return null
    if (argChildren.length >= 2) {
        const pos = ctx.lift(argChildren[0])
        const len = ctx.lift(argChildren[1])
        return createNode('cpp:string_erase', {}, {
          obj: [recv],
          pos: pos ? [pos] : [],
          len: len ? [len] : [],
        })
      }
      return null // 1 arg → container erase (handled by METHOD_TO_COMPONENT)
  })
}
