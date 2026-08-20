/**
 * `cpp:range_sort` 的 **execute** 路
 *
 * ⚠️ **不能用 `Array.prototype.sort`**：比較器是使用者的程式碼，跑它要 `await`
 * ——而 `sort` 的 comparator 不接受 Promise（見 `runtime/order.ts` 的檔頭）。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
import { resolveRange } from '../../../languages/cpp/core/runtime/range'
import { defaultLess, asyncSort } from '../../../languages/cpp/core/runtime/order'
import { callWithValues } from '../../../languages/cpp/core/runtime/lambda'

export function registerGenerateUnused(): void {}

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:range_sort', async (node, ctx) => {
      const r = resolveRange(ctx as never, String(node.properties.begin), String(node.properties.end))
      const cells = r.arr as RuntimeValue[]
      const cmpNode = (node.children.comparator ?? [])[0]

      // 沒有比較器 → C++ 的預設 `operator<`（對 `pair` 是字典序）
      let less = async (a: RuntimeValue, b: RuntimeValue): Promise<boolean> => defaultLess(a, b)
      if (cmpNode) {
        // 求值一次就好——比較器在整趟排序裡是同一個東西，
        // 每次比較都重新求值的話，lambda 的捕捉會在排序途中被重拍
        const fn = await ctx.evaluate(cmpNode)
        less = async (a, b) => ctx.toBool(await callWithValues(fn, [a, b], ctx))
      }

      const sorted = await asyncSort(cells.slice(r.from, r.to), less)
      for (let i = 0; i < sorted.length; i++) cells[r.from + i] = sorted[i]
    })
}
