/** `cpp:set_declare` 的 **execute** 路——從共用檔原封剪過來（批次第七批：容器樣板過渡表退場）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:set_declare', async (node, ctx) => {
      const name = String(node.properties.name)
      // 🔴 **重複性跟著值走**（2026-09-17）：讀它的 `insert()` 只拿得到變數名，
      //    宣告那一行當時已經不在手上了。同 `heapOrder` 的處置。
      //    ⚠️ 舊存檔沒有這個屬性 ⟹ 是 `set`，不留重複。
      const allowsDuplicates = String(node.properties.unique ?? 'true') === 'false'
      ctx.scope.declare(name, { type: 'array', value: [], allowsDuplicates })
    })
}
