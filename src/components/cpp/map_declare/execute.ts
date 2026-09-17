/** `cpp:map_declare` 的 **execute** 路——從共用檔原封剪過來（批次第七批：容器樣板過渡表退場）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { cloneValue } from '../../../interpreter/clone'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:map_declare', async (node, ctx) => {
      const name = String(node.properties.name)
      // 🔴 **`keyed` 說的是「我的條目是鍵值對」**（2026-09-17）。
      //    在此之前對應表與集合在執行期完全分不出來，而共用同一個方法名的
      //    `insert` 只能靠「翻開條目看它是不是一對」——那在空容器上失效，
      //    在 `multiset<pair<int,int>>` 上會答錯。
      /**
       * 🔴 **用另一個容器建起來**（2026-09-17）——`map<char,int> r = f();`。
       * 理由與複製的分寸見同族那顆集合的註解（`cloneValue`，不是接管）。
       */
      const source = (node.slots.source ?? [])[0]
      const initial = source ? await ctx.evaluate(source) : null
      const cells = initial && initial.type === 'array' && Array.isArray(initial.value)
        ? initial.value.map(cloneValue)
        : []
      // 🔴 **值的型別要跟著對照表走**——`m[k]` 自動建一格時要照它的形狀補
      //    （見 `RuntimeValue.valueType` 的檔頭）。
      const valueType = String(node.properties.value_type ?? 'int')
      ctx.scope.declare(name, { type: 'array', value: cells, keyed: true, valueType })
    })
}
