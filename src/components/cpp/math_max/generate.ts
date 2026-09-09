/** `cpp:math_max` 的 **generate** 路——從共用檔原封剪過來（批次第六批：lift 是 io.ts 的一個帶真邏輯的分支）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:math_max', (node, ctx) => {
      const aNodes = node.children.a ?? []
      const bNodes = node.children.b ?? []
      // 🔴 **只有一個運算元時就產一個引數——不得補一個 `0`**（2026-09-09）
      //
      // `max({a, b, c})` 是**合法的 C++**（大括號那個多載），而競賽程式常寫它。
      // 補上去的第二個引數讓它**編不過**：
      //
      // ```
      // 原文   max({ans, f(l,mid), f(mid+1,r)})
      // 產出   max({ans, f(l,mid), f(mid+1,r)}, 0)     🔴 拿列表跟 int 比
      // ```
      //
      // > **一個看起來合理的預設值，把「這裡沒有資料」偽裝成「這裡的資料是 0」**
      // > （`cpp:array_declare` 的 `?? '10'` 是同一族，2026-08-18 由 fuzz 抓到）。
      //
      // ⚠️ **兩個都空的時候才補**——那是一顆剛拖出來、還沒接東西的積木，
      // 而那時候任何產出都是佔位，`max()` 編不過而 `max(0, 0)` 編得過。
      const parts = [aNodes[0], bNodes[0]]
        .filter((n): n is NonNullable<typeof n> => n != null)
        .map((n) => generateExpression(n, ctx))
      if (parts.length === 0) return `max(0, 0)`
      return `max(${parts.join(', ')})`
    })
}
