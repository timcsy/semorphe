/** `cpp:map_declare` 的 **execute** 路——從共用檔原封剪過來（批次第七批：容器樣板過渡表退場）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:map_declare', async (node, ctx) => {
      const name = String(node.properties.name)
      // 🔴 **`keyed` 說的是「我的條目是鍵值對」**（2026-09-17）。
      //    在此之前對應表與集合在執行期完全分不出來，而共用同一個方法名的
      //    `insert` 只能靠「翻開條目看它是不是一對」——那在空容器上失效，
      //    在 `multiset<pair<int,int>>` 上會答錯。
      ctx.scope.declare(name, { type: 'array', value: [], keyed: true })
    })
}
