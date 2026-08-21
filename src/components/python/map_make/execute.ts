/**
 * `python:map_make` 的 **execute** 路。
 *
 * ⚠️ 執行期的字典用 `object` 這個值型別（與 C++ 那側的對應容器同一個）
 * ——**鍵一律轉成字串**，
 * 因為底層是 JS 的 Map/物件，而 `1` 與 `"1"` 在 Python 是不同的鍵。
 * 🔴 那是一個**已知的簡化**，寫在這裡而不是靜靜地做。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue, ObjectFields } from '../../../interpreter/types'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:map_make', async (node, ctx) => {
    // 🟢 **用 `Map` 不用普通物件**——鍵可能撞到 `toString`／`constructor`，
    //    而那種撞名會讓「讀一個不存在的鍵」靜默成功（見 `ObjectFields` 的說明）。
    const entries: ObjectFields = new Map()
    for (const p of node.children.pairs ?? []) {
      const kv = await ctx.evaluate(p)
      if (kv.type !== 'array' || !Array.isArray(kv.value)) continue
      const [k, v] = kv.value as RuntimeValue[]
      entries.set(String(k?.value), v)
    }
    return { type: 'object', value: entries, structName: 'dict' }
  })
}
