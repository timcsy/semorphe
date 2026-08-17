/**
 * `cpp:serial_print` 的 **lift** 路——**一個看得到 `obj` 的分支**。
 *
 * ⚠️ `print` 與 `println` 進**同一顆身分**，差別進 `newline` 屬性
 * ——與 `cpp:container_iter` 用 `which` 區分 `begin`／`end` 是同一個做法。
 *
 * 🔴 而**綁 `obj === 'Serial'`** 不只是保險：`print` 是一個很普通的方法名，
 * 而一張只放得下方法名的表會讓**任何物件的 `.print()`** 都變成序列埠輸出。
 */
import type { SemanticNode } from '../../../core/types'
import { registerMethodBranch } from '../../../core/component/lift-branches'
import { createNode } from '../../../core/semantic-tree'

export function registerLift(): void {
  registerMethodBranch('cpp/serial_print', (obj, method, argChildren, ctx): SemanticNode | null => {
    if (obj !== 'Serial' || (method !== 'print' && method !== 'println')) return null
    // 🔴 **第二個引數不能靜默丟掉。**
    //
    // `Serial.print(v, 3)` 的 `3` 是**小數位數**（`Serial.print(v, HEX)` 是進位）。
    // 2026-08-17 盲測抓到：第一版 `argSlots` 只有一格，於是 `3` **不見了**
    // ——輸出是 `-50` 而不是 `-50.000`，**而沒有任何地方出聲**。
    //
    // > **一個被靜默丟掉的引數，症狀是「輸出格式不對」，
    // > 而那看起來像格式化的 bug，不像「我根本沒收到那個參數」。**
    const value = argChildren[0] ? ctx.lift(argChildren[0]) : null
    const format = argChildren[1] ? ctx.lift(argChildren[1]) : null
    return createNode(
      'cpp:serial_print',
      { obj, newline: method === 'println' ? 'true' : 'false' },
      { value: value ? [value] : [], format: format ? [format] : [] },
    )
  })
}
