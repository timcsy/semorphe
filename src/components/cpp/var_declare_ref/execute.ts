/** `cpp:var_declare_ref` 的 **execute** 路——從共用檔原封剪過來（批次第三十批）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import { execVarDeclare } from '../../../interpreter/executors/variables'
// ⚠️ 問**性狀**不問身分——一顆膠囊裡寫另一顆的身分，就近性護欄的反向檢查會指名。
import { isVariableRef } from '../../../languages/cpp/core/node-traits'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  /**
     * `int& r = a;`——**別名，不是複製**。
     *
     * ⚠️ 在此之前它註冊的是 `execVarDeclare`，於是 `r = 9` 只改到 r：
     * `cout << a << r` 印出 **59**，而 g++ 印 **99**。**參照這個概念完全沒有意義。**
     *
     * `Scope.declareRef` 一直都在——又一次「機制有了，沒人接上」。
     */
    register('cpp:var_declare_ref', async (node, ctx) => {
      const name = String(node.properties.name)
      const inits = node.children.initializer ?? []
      const 目標 = inits[0]
      if (目標 && isVariableRef(目標.conceptId) && 目標.properties?.name !== undefined) {
        // `get`／`set` 會沿 parent 往上找，所以目標作用域傳當前的就夠
        ctx.scope.declareRef(name, ctx.scope, String(目標.properties.name))
        return
      }
      // 綁到非變數（例如 `int& r = f();`）——**不是別名做得到的事**。
      // 退回一般宣告，行為與加入本執行器之前相同。
      await execVarDeclare(node, ctx)
    })
}
