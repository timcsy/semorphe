/**
 * `cpp:string_insert` 的 **lift** 路——**一個帶真邏輯的分支**
 *
 * 判別本身是這顆元件的知識（引數個數／函式名的多種寫法），不是路由器的知識。
 * 回傳 `null` = 「這一段不是我」，路由器繼續問下一個。
 */
import type { SemanticNode } from '../../../core/types'
import { registerMethodBranch } from '../../../core/component/lift-branches'
import { createNode } from '../../../core/semantic-tree'

export function registerLift(): void {
  registerMethodBranch('cpp/string_insert', (obj, method, argChildren, ctx, objNode): SemanticNode | null => {
    if (method !== 'insert') return null
    /**
     * 🔴 **兩個引數不足以認定「這是字串」**（2026-09-18，第三次同一個病）。
     *
     * `v.insert(v.begin(), 9)` 是**定位插入**，而這條分支只看引數個數
     * 就認領了它——於是那個位置被當成「插在第幾個字」，
     * 而整個列表被重建成一串文字：`v[0]` 印出來是 `[9`。
     *
     * ⚠️ 同族的刪除（`erase`）2026-09-18 早上才因為一模一樣的理由修過一次，
     * 而**這一顆沒有跟著修**。
     *
     * > **一個只看引數個數的判別，在另一個型別剛好也收兩個引數時
     * > 不會落空——它會安靜地把那個東西當成自己的。**
     *
     * 🟢 判準與同族一致：**問接收者的宣告型別**（脈絡查得到）。
     * ⚠️ 查不到就讓開——猜一個錯的專屬身分比誠實降級更糟。
     */
    const t = obj ? ctx.data.getType(obj) : null
    if (t !== 'string') return null
    // 🔴 **接收者是一棵樹**（2026-09-18）——`parts[i].insert(…)`
    const recv = objNode ? ctx.lift(objNode) : null
    if (!recv) return null
    if (argChildren.length >= 2) {
        const pos = ctx.lift(argChildren[0])
        const value = ctx.lift(argChildren[1])
        return createNode('cpp:string_insert', {}, {
          obj: [recv],
          pos: pos ? [pos] : [],
          value: value ? [value] : [],
        })
      }
      return null // 1 arg → set insert (handled by METHOD_TO_COMPONENT)
  })
}
