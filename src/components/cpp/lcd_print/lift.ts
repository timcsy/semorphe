/**
 * `cpp:lcd_print` 的 **lift** 路——**「`LiquidCrystal` 上的 `.print()` 是我」**
 *
 * 🔴 **走分支而不是「型別 → 方法」那張純資料表**，理由是【引數會被丟掉】：那張表的消費者用一組共用的 `METHODS_WITH_ARG` 決定要不要接引數，而這顆的引數不在那組裡——⚠️ 症狀是**引數安靜地不見**，而程式碼照樣產得出來。
 * 
 * 🟢 分支拿得到 `ctx`，所以它自己查接收者的宣告型別。**型別是宣告出來的，不是猜的。**
 * 
 * ⚠️ **型別查不到時不認**——留在通用的方法呼叫。猜一個錯的專屬身分比誠實降級更糟。
 */
import type { SemanticNode } from '../../../core/types'
import { registerMethodBranch } from '../../../core/component/lift-branches'
import { createNode } from '../../../core/semantic-tree'

export function registerLift(): void {
  registerMethodBranch('cpp/lcd_print', (obj, method, argChildren, ctx): SemanticNode | null => {
    if (method !== 'print') return null
    if (argChildren.length !== 1) return null
    if (!obj || ctx.data.getType(obj) !== 'lcd') return null
    const valueNode = argChildren[0] ? ctx.lift(argChildren[0]) : null
    return createNode('cpp:lcd_print', { obj }, {
      value: valueNode ? [valueNode] : [],
    })
  })
}
