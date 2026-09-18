/**
 * `cpp:range_find` 的 **execute** 路
 *
 * ⚠️ 回傳的是**位置**不是值——「找不到」在 C++ 裡用**結尾之後的位置**表示，
 *    沒有別的哨兵值。回傳 -1 或 `null` 的話，`if (it == end(a))` 這個
 *    標準寫法會永遠不成立，而**它不會報錯**。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { resolveRange } from '../../../languages/cpp/lang/runtime/range'
import { positionIn } from '../../../interpreter/pointer'
import { equivalentInOrder } from '../../../languages/cpp/lang/runtime/order'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:range_find', async (node, ctx) => {
    const r = await resolveRange(ctx, (node.slots.begin ?? [])[0], (node.slots.end ?? [])[0])
    const target = await ctx.evaluate((node.slots.value ?? [])[0])
    /**
     * 🔴 **「是不是同一個」問的是順序關係，不是 `==`**——與同族的集合插入
     *    同一條理由（見那顆的註解）：只比 `.value` 對**物件**永遠回 false。
     * ⚠️ 而 `find` 在 C++ 上用的確實是 `operator==`——這裡用等價關係是
     *    **刻意的近似**，而它在這個直譯器裡是更保險的那一邊：
     *    純量上兩者一致，物件上 `==` 這裡本來就答不出來。
     */
    for (let i = r.from; i < r.to && i < r.arr.length; i++) {
      if (await equivalentInOrder(r.arr[i], target, ctx)) return positionIn(r.arr, i)
    }
    return positionIn(r.arr, r.to)
  })
}
