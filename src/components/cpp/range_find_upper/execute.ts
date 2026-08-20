/**
 * `cpp:range_find_upper` 的 **execute** 路
 *
 * ⚠️ 回傳的是**位置**（陣列 ＋ `offset`），不是值——見 `component.json` 的 `_execute_why`。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
import { resolveRange, numOf } from '../../../languages/cpp/core/runtime/range'

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:range_find_upper', async (node, ctx) => {
      const r = resolveRange(ctx as never, String(node.properties.begin), String(node.properties.end))
      // `resolveRange` 的 `arr` 宣告成 `unknown[]`（它不必知道元素是什麼）——
      // 這裡收窄一次，而不是讓每一行各自 cast。
      const cells = r.arr as RuntimeValue[]
      const valueNode = (node.children.value ?? [])[0]
      const target = valueNode ? numOf(await ctx.evaluate(valueNode)) : 0
      // **二分搜**——範圍必須已排序，那是 C++ 對呼叫端的要求，不是我們檢查得起的。
      let lo = r.from
      let hi = r.to
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        const v = numOf(cells[mid])
        if (v <= target) lo = mid + 1
        else hi = mid
      }
      return { type: 'array' as const, value: cells, offset: lo }
    })
}
