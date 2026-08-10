/**
 * `<map>` 的執行路——膠囊的第五面牆。
 *
 * 在此之前它住在 `src/interpreter/executors/containers.ts`，讓核心層認識了 2 個 C++ 專屬的概念身分。
 *
 * 見 specs/054-execute-into-capsules/
 */
import type { ConceptExecutor } from '../../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../../interpreter/types'
import { defaultValue } from '../../../../interpreter/types'
import { valueToString } from '../../../../interpreter/types'

/**
 * Map is stored as { type: 'array', value: [ [keyRV, valRV], [keyRV, valRV], ... ] }
 * where each pair is a 2-element RuntimeValue[].
 * We wrap pairs as RuntimeValue with type='array'.
 */

function mapFind(pairs: RuntimeValue[], keyVal: RuntimeValue): number {
  const keyStr = valueToString(keyVal)
  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i]
    if (pair.type === 'array' && Array.isArray(pair.value) && pair.value.length >= 1) {
      if (valueToString(pair.value[0]) === keyStr) return i
    }
  }
  return -1
}

export function registerExecutors(
  register: (concept: string, executor: ConceptExecutor) => void,
): void {
  register('cpp:map_declare', async (node, ctx) => {
    const name = String(node.properties.name)
    ctx.scope.declare(name, { type: 'array', value: [] })
  })

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
      map.value.push({ type: 'array', value: [keyVal, val] })
      return
    }
    const pair = map.value[idx]
    if (pair.type === 'array' && Array.isArray(pair.value)) pair.value[1] = val
  })

  register('cpp:map_at', async (node, ctx) => {
    const name = String(node.properties.obj)
    const keyNodes = node.children.key ?? []
    if (keyNodes.length === 0) return defaultValue('int')
    const keyVal = await ctx.evaluate(keyNodes[0])
    const map = ctx.scope.get(name)
    if (map.type !== 'array' || !Array.isArray(map.value)) {
      return defaultValue('int')
    }
    const idx = mapFind(map.value, keyVal)
    if (idx === -1) {
      // C++ map auto-inserts default on access
      const newVal = defaultValue('int')
      const pair: RuntimeValue = { type: 'array', value: [keyVal, newVal] }
      map.value.push(pair)
      return newVal
    }
    const pair = map.value[idx]
    if (pair.type === 'array' && Array.isArray(pair.value) && pair.value.length >= 2) {
      return pair.value[1]
    }
    return defaultValue('int')
  })

  // ─── Set (simulated with array + uniqueness) ───
}
