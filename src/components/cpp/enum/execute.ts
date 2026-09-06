/** `cpp:enum` 的 **execute** 路——從共用檔原封剪過來（批次第三批：lift 是只產一種身分的具名策略）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  /**
     * `enum Color { RED = 1, GREEN = 5, BLUE = 9 };`
     *
     * ⚠️ 原本是**空操作**，而且被宣告成 `declarative`（刻意不執行）。
     * **那個宣告是錯的**——列舉要把它的常數放進作用域，不放的話 `GREEN`
     * 是一個未宣告變數，程式直接中斷。
     *
     * 「刻意不執行」與「還沒實作」的分界在 history/018：前者要說得出理由，
     * 而這裡的理由（declarative）**經不起一支會用到那些常數的程式**。
     *
     * 值以字串存著（`"RED = 1, GREEN = 5, BLUE = 9"`）——那是既有的技術債
     * （同 func_def 的參數），不在這一刀的範圍。沒寫值的成員依 C++ 規則
     * 從前一個 +1 開始。
     */
    register('cpp:enum', async (node, ctx) => {
      const raw = String(node.properties.values ?? '')
      let next = 0
      for (const part of raw.split(',')) {
        const s = part.trim()
        if (!s) continue
        const eq = s.indexOf('=')
        const name = (eq >= 0 ? s.slice(0, eq) : s).trim()
        if (!name) continue
        if (eq >= 0) {
          const v = Number(s.slice(eq + 1).trim())
          if (!Number.isNaN(v)) next = v
        }
        // 🔴 **使用者宣告的贏**（2026-09-06，spec 174）。
        //
        //    直譯器在啟動時把**全部**內建常數塞進全域作用域
        //    （`interpreter.ts` 的 `allBuiltinConstants()`），所以
        //    `enum Marker { EOF = -99 };` 會撞上那一份，丟 `DUPLICATE_DECLARATION`
        //    ——⚠️ 而那個訊息**說錯了原因**：使用者只宣告了一次。
        //
        // > **一個「你重複宣告了」的錯誤訊息，
        // > 在另一個宣告是系統自己塞的時候，指控的是無辜的那一方。**
        //
        // 🟢 判準與 lift 那一側**同一個**：沒有人宣告它，它才是環境提供的。
        //    這裡是它的另一半——**有人宣告了，就以他的為準**。
        ctx.scope.declareOverridingBuiltin(name, { type: 'int', value: next })
        next += 1
      }
    })
}
