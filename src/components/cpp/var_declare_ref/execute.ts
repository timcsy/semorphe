/** `cpp:var_declare_ref` 的 **execute** 路——從共用檔原封剪過來（批次第三十批）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { execVarDeclare } from '../../../interpreter/executors/variables'
// ⚠️ 問**性狀**不問身分——一顆膠囊裡寫另一顆的身分，就近性護欄的反向檢查會指名。
import { isVariableRef } from '../../../languages/cpp/lang/node-traits'
import { resolvePlace } from '../../../interpreter/lvalue'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
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
      const inits = node.slots.initializer ?? []
      const target = inits[0]
      if (target && isVariableRef(target.componentId) && target.properties?.name !== undefined) {
        // `get`／`set` 會沿 parent 往上找，所以目標作用域傳當前的就夠
        ctx.scope.declareRef(name, ctx.scope, String(target.properties.name))
        return
      }
      /**
       * 🔴 **綁到一個【算出來的位置】**（2026-09-20）——`int &r = a[1];`、`int &r = s.a;`。
       *
       * 在此之前這裡只有下面那條「退回一般宣告」，於是 `r = 7` 只改到 `r`
       * ——**與上面那段檔頭在治的病一模一樣，只是換一種左值**。
       *
       * > **一個修好了「變數」那一格的修法，會讓其餘每一種左值
       * > 看起來像是「還沒輪到」，而它們其實走的是同一條錯的退路。**
       */
      if (target) {
        try {
          const place = await resolvePlace(target, ctx)
          ctx.scope.declarePlaceRef(name, place)
          return
        } catch {
          // 解不出位置（`int& r = f();`）——不是別名做得到的事，走下面那條
        }
      }
      // 綁到非位置（例如 `int& r = f();`）——**不是別名做得到的事**。
      // 退回一般宣告，行為與加入本執行器之前相同。
      await execVarDeclare(node, ctx)
    })
}
