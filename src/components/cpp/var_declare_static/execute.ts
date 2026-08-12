/** `cpp:var_declare_static` 的 **execute** 路——從共用檔原封剪過來（批次第二十一批：建構子）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import { defaultValue } from '../../../interpreter/types'
import { rootScope } from '../../../languages/cpp/core/runtime/scope'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  /**
     * `static int n = 0;` 在函式裡——**跨呼叫保存**。
     *
     * ⚠️ 在此之前它註冊的是 `execVarDeclare`，於是每次呼叫都重新初始化：
     * `tick(); tick(); tick()` 印出 **111**，而 g++ 印 **123**。
     *
     * **而這個缺陷之所以三個月沒被發現，正是因為它與 `var_declare` 共用執行器**
     * ——身分健檢護欄報「六顆宣告完全相同」時，那看起來像「可以合併」，
     * 實際上是「有兩顆的行為沒有被模型化」。**共用執行器讓「沒實作」長得像「一樣」。**
     *
     * 儲存位置是**根作用域**，鍵用宣告節點的 id——同一個宣告點共用一格，
     * 不同函式的同名 static 互不干擾。別名機制（`declareRef`）本來就在。
     */
    register('cpp:var_declare_static', async (node, ctx) => {
      const name = String(node.properties.name)
      const type = String(node.properties.type || 'int')
      const storedName = `__static__${node.id}__${name}`
      const root = rootScope(ctx.scope)

      if (!root.has(storedName)) {
        const inits = node.children.initializer ?? []
        const initValue = inits.length > 0 ? await ctx.evaluate(inits[0]) : defaultValue(type)
        root.declare(storedName, ctx.coerceType ? ctx.coerceType(initValue, type) : initValue)
      }
      // 本次呼叫的區域名字指向那一格
      ctx.scope.declareRef(name, root, storedName)
    })
}
