/** `cpp:enum` 的 **execute** 路——從共用檔原封剪過來（批次第三批：lift 是只產一種身分的具名策略）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
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
        ctx.scope.declare(name, { type: 'int', value: next })
        next += 1
      }
    })
}
