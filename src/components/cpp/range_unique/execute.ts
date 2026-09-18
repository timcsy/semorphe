/**
 * `cpp:range_unique` 的 **execute** 路
 *
 * 🔴 **不改變長度**——它把留下來的往前搬，回傳「新的結尾」這個位置。
 * 那是 C++ 的規矩，也是「刪除-移除」這個慣用法為什麼是**兩步**：
 *
 * ```cpp
 * sort(v.begin(), v.end());
 * v.erase(unique(v.begin(), v.end()), v.end());   // 第二步才真的變短
 * ```
 *
 * ⚠️ 只擠掉**相鄰**的重複——沒排序過的範圍上它的結果是對的（C++ 也是這樣），
 *    只是不會把所有重複都去掉。**不要替使用者先排序**：那會改掉他沒叫我們改的東西。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { resolveRange } from '../../../languages/cpp/lang/runtime/range'
import { positionIn } from '../../../interpreter/pointer'
import { equivalentInOrder } from '../../../languages/cpp/lang/runtime/order'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:range_unique', async (node, ctx) => {
    const r = await resolveRange(ctx, (node.slots.begin ?? [])[0], (node.slots.end ?? [])[0])
    const hi = Math.min(r.to, r.arr.length)
    if (r.from >= hi) return positionIn(r.arr, r.from)
    let write = r.from + 1
    for (let i = r.from + 1; i < hi; i++) {
      if (!(await equivalentInOrder(r.arr[i], r.arr[write - 1], ctx))) {
        r.arr[write] = r.arr[i]
        write++
      }
    }
    return positionIn(r.arr, write)
  })
}
