/**
 * `cpp:range_remove` 的 **execute** 路
 *
 * 🔴 **不改變長度**——見同族那顆擠掉重複的說明：真的變短是 `erase` 的事。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { resolveRange } from '../../../languages/cpp/lang/runtime/range'
import { positionIn } from '../../../interpreter/pointer'
import { equivalentInOrder } from '../../../languages/cpp/lang/runtime/order'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:range_remove', async (node, ctx) => {
    const r = await resolveRange(ctx, (node.slots.begin ?? [])[0], (node.slots.end ?? [])[0])
    const target = await ctx.evaluate((node.slots.value ?? [])[0])
    const hi = Math.min(r.to, r.arr.length)
    let write = r.from
    for (let i = r.from; i < hi; i++) {
      if (!(await equivalentInOrder(r.arr[i], target, ctx))) {
        r.arr[write] = r.arr[i]
        write++
      }
    }
    return positionIn(r.arr, write)
  })
}
