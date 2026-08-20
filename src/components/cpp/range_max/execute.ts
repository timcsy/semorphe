/**
 * `cpp:range_max` 的 **execute** 路
 *
 * ⚠️ 回傳的是**位置**（陣列 ＋ `offset`），不是值——見 `component.json` 的 `_execute_why`。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
import { resolveRange, numOf } from '../../../languages/cpp/core/runtime/range'

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:range_max', async (node, ctx) => {
      const r = resolveRange(ctx as never, String(node.properties.begin), String(node.properties.end))
      // `resolveRange` 的 `arr` 宣告成 `unknown[]`（它不必知道元素是什麼）——
      // 這裡收窄一次，而不是讓每一行各自 cast。
      const cells = r.arr as RuntimeValue[]
      // 空範圍回傳結尾之後的位置——與 C++ 一致（`max_element` 對空範圍回 `end`）。
      if (r.to <= r.from) return { type: 'array' as const, value: cells, offset: r.to }
      let best = r.from
      for (let i = r.from + 1; i < r.to; i++) {
        if (numOf(cells[i]) > numOf(cells[best])) best = i
      }
      return { type: 'array' as const, value: cells, offset: best }
    })
}
