/**
 * `cpp:servo_attach` 的 **lift** 路——**「`Servo` 上的 `.attach()` 是我」**
 *
 * 🔴 **走分支而不是「型別 → 方法」那張純資料表**，理由是【引數會被丟掉】：那張表的消費者用一組共用的 `METHODS_WITH_ARG` 決定要不要接引數，而這顆的引數不在那組裡——⚠️ 症狀是**引數安靜地不見**，而程式碼照樣產得出來。
 * 
 * 🟢 分支拿得到 `ctx`，所以它自己查接收者的宣告型別。**型別是宣告出來的，不是猜的。**
 * 
 * ⚠️ **型別查不到時不認**——留在通用的方法呼叫。猜一個錯的專屬身分比誠實降級更糟。
 *
 * ## 🔴 而比對的是【概念名】不是 C++ 的型別名
 *
 * `core/lift/lifter.ts` 的 `recordDeclaration` 從**概念身分**推型別：
 *
 * ```
 * cpp:servo_declare  →  記成 'servo'      ← 不是 'Servo'
 * cpp:string_declare →  記成 'string'
 * ```
 *
 * 那是既有的慣例（`registerTypedMethodComponent('string', …)` 也是這樣對上的）。
 * ⚠️ 第一版寫 `'Servo'`，於是**每一顆方法都認不出來**——而症狀是
 * 「宣告認得出來、方法認不出來」，看起來像方法那一側壞了。
 *
 * > **一個從身分推導出來的值，形狀由推導規則決定，不由它描述的東西決定。**
 */
import type { SemanticNode } from '../../../core/types'
import { registerMethodBranch } from '../../../core/component/lift-branches'
import { createNode } from '../../../core/semantic-tree'

export function registerLift(): void {
  registerMethodBranch('cpp/servo_attach', (obj, method, argChildren, ctx): SemanticNode | null => {
    if (method !== 'attach') return null
    if (argChildren.length !== 1) return null
    if (!obj || ctx.data.getType(obj) !== 'servo') return null
    const pinNode = argChildren[0] ? ctx.lift(argChildren[0]) : null
    return createNode('cpp:servo_attach', { obj }, {
      pin: pinNode ? [pinNode] : [],
    })
  })
}
