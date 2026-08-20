/** `cpp:map_assign` 的 **execute** 路——從共用檔原封剪過來（批次第十批：assignment_expression 的分支）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { mapFind, makePair, setPairValue } from '../../../languages/cpp/core/runtime/map'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  /**
     * `m[key] = value`——**對應表的寫入，與陣列的索引寫入是不同的行為**。
     *
     * ⚠️ 在此之前 `m["x"] = 7` 被辨識成 `array_assign`，而那個執行器把 `"x"`
     * 當索引（`toNumber("x")`）→ 寫進一個不存在的位置。**沒有任何測試碰過它**
     * ——`cpp_map_at` 是第十八條護欄報出的「零測試足跡」三顆之一。
     *
     * 差別在律：**陣列的索引超出範圍是錯誤，對應表的鍵不存在是插入。**
     * 所以這不能與 `array_assign` 共用一顆——共用就要在執行器裡分支，
     * 而那是把碎裂搬進元件內部。
     */
    register('cpp:map_assign', async (node, ctx) => {
      const name = String(node.properties.obj)
      const keyNodes = node.children.key ?? []
      const valueNodes = node.children.value ?? []
      if (keyNodes.length === 0 || valueNodes.length === 0) return
      const keyVal = await ctx.evaluate(keyNodes[0])
      const val = await ctx.evaluate(valueNodes[0])
      const map = ctx.scope.get(name)
      if (map.type !== 'array' || !Array.isArray(map.value)) return
      const idx = mapFind(map.value, keyVal)
      if (idx === -1) {
        map.value.push(makePair(keyVal, val))
        return
      }
      setPairValue(map.value[idx], val)
    })
}
