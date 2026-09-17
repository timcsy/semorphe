/** `cpp:var_declare` 的 **execute** 路——從共用檔原封剪過來（probe）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { execVarDeclare } from '../../../interpreter/executors/variables'
import { resolveAlias } from '../../../interpreter/aliases'
import { containerDefaultFor } from '../../../languages/cpp/lang/runtime/container-defaults'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:var_declare', async (node, ctx) => {
    /**
     * 🔴 **一個型別別名可能指向一個容器**（2026-09-18，資訊隔離的盲測）。
     *
     * ```cpp
     * typedef map<int, set<int>> Graph;
     * Graph g;  g[a].insert(b);
     * ```
     *
     * 走到這一顆代表**辨識沒有認出它是容器**——`Graph g;` 在語法上就是一個
     * 普通的變數宣告，而別名要到執行期才解得開（`cpp:typedef` 的執行器登記它）。
     *
     * ⚠️ **刻意不在 lift 期展開**：展開的話產出的程式碼會變成
     * `map<int, set<int>> g;`——一支與學生寫的不同的程式。
     * > **一個別名的意義就是那個短名字；把它換掉等於把它拿掉。**
     *
     * ⚠️ 而**只在沒有初始值時**接手：有初始值的走原本那條（它要做聚合初始化）。
     */
    const init = node.slots.initializer ?? node.slots.value ?? []
    const declared = node.properties.type
    const named = node.properties.name
    // ⚠️ **不寫退路**：`?? 'int'` 會讓一個沒有型別的節點被當成 int 的容器去問
    //    ——而宣告的 default 是什麼，不該由這裡重講一次（第一百一十九條）。
    if (init.length === 0 && typeof declared === 'string' && typeof named === 'string') {
      const made = containerDefaultFor(resolveAlias(declared))
      if (made) { ctx.scope.declare(named, made); return }
    }
    return execVarDeclare(node, ctx)
  })
}
