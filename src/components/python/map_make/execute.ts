/**
 * `python:map_make` 的 **execute** 路。
 *
 * ⚠️ 執行期的字典用 `object` 這個值型別（與 C++ 那側的對應容器同一個），
 * 而底層的 `Map` 只吃字串——所以查詢用字串鍵，**而每個鍵原本的值存在旁邊
 * 一張表裡**（`languages/python/dict.ts`）。少了那張表的症狀是
 * `print({1: 1})` 印出 `{'1': 1}`：不報錯、有輸出、而型別看得見地錯了。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue, ObjectFields } from '../../../interpreter/types'
// 🔴 「鍵原本長什麼樣」只有一份——見那個模組的檔頭。
import { dictKeyOf, makeDict } from '../../../languages/python/dict'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:map_make', async (node, ctx) => {
    // 🟢 **用 `Map` 不用普通物件**——鍵可能撞到 `toString`／`constructor`，
    //    而那種撞名會讓「讀一個不存在的鍵」靜默成功（見 `ObjectFields` 的說明）。
    const entries: ObjectFields = new Map()
    const keys = new Map<string, RuntimeValue>()
    for (const p of node.children.pairs ?? []) {
      const kv = await ctx.evaluate(p)
      if (kv.type !== 'array' || !Array.isArray(kv.value)) continue
      const [k, v] = kv.value as RuntimeValue[]
      entries.set(dictKeyOf(k), v)
      keys.set(dictKeyOf(k), k)
    }
    return makeDict(entries, keys)
  })
}
