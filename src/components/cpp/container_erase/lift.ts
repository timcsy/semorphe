/**
 * `cpp:container_erase` 的 **lift** 路——**一筆資料：「`erase` 這個方法名屬於我」**
 *
 * ⚠️ 登錄的是**容器方法表**，不是一般的方法表。差別是**查詢點**：
 * 容器方法要先依接收者型別分派、並記下 `container_kind`（形態要用）。
 * 塞進早期那張表會被先攔截，而那不會報錯，只會安靜地少掉資訊。
 */
import { registerContainerMethodComponent } from '../../../core/component/method-components'

export function registerLift(): void {
  registerContainerMethodComponent('erase', 'cpp:container_erase', 'cpp/container_erase')
  registerRangeEraseBranch()
}

/**
 * 🔴 **兩個引數時，第二個進它自己的接點**（2026-09-18）。
 *
 * 那張容器方法表把所有引數塞進同一個 `key`，而積木上那一格只接得住第一個
 * ——症狀見 `component.json` 的 `_slots_why`。
 *
 * ⚠️ **只接管兩個引數的情形**：一個引數的仍然走那張表（它是絕大多數），
 *    這樣既有的每一條路一行都不變。
 * ⚠️ 而方法分支跑在型別分派**之前**，所以這裡要**認得出自己不是誰**
 *    ——`erase` 收兩個引數的只有「一段範圍」這一種用法。
 */
import type { SemanticNode } from '../../../core/types'
import { registerMethodBranch } from '../../../core/component/lift-branches'
import { createNode } from '../../../core/semantic-tree'

export function registerRangeEraseBranch(): void {
  registerMethodBranch('cpp/container_erase', (obj, method, argChildren, ctx, objNode): SemanticNode | null => {
    if (method !== 'erase' || argChildren.length !== 2) return null
    /**
     * 🔴 **兩個引數不足以認定「這是容器」**（2026-09-18，第四次同一個病）。
     *
     * ```cpp
     * s.erase(2, 3);                    // 字串：從第 2 個字刪 3 個 —— 另有主人
     * v.erase(v.begin(), v.end());      // 容器：刪掉一整段
     * ```
     *
     * 這條分支第一版只看引數個數，於是**把字串的那一種搶走了**
     * ——三支測試當場紅（`cpp:string_erase` 在樹裡不見了、`abcdef` 沒被刪成 `adef`）。
     *
     * ⚠️ 而隔壁那顆膠囊的註解**逐字寫過這件事**，就在我改它的那一天：
     * > 「一個只看引數個數的判別，在另一個型別剛好也收兩個引數時不會落空
     * > ——它會安靜地把那個東西當成自己的。」
     *
     * 🟢 判準與同族一致：**問接收者的宣告型別**。
     * ⚠️ **查不到就讓開**——那時 `s` 與 `v` 分不出來，而猜錯的代價是
     *    「刪一整段」與「從第幾個字刪幾個」互換，**兩種都編得過**。
     */
    const t = obj ? ctx.data.getType(obj) : null
    if (!t || t === 'string' || t.includes('char*')) return null
    const recv = objNode ? ctx.lift(objNode) : null
    const from = ctx.lift(argChildren[0])
    const to = ctx.lift(argChildren[1])
    // 接不出來就**讓開**——猜一個錯的專屬身分比誠實降級更糟。
    if (!recv || !from || !to) return null
    return createNode('cpp:container_erase', {}, { obj: [recv], key: [from], key_end: [to] })
  })
}
