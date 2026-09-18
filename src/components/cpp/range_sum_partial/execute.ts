/** `cpp:range_sum_partial` 的 **execute** 路——從共用檔原封剪過來（批次第六批：lift 是 io.ts 的一個帶真邏輯的分支）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { resolveRange, numOf } from '../../../languages/cpp/lang/runtime/range'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:range_sum_partial', async (node, ctx) => {
      const r = await resolveRange(ctx, (node.slots.begin ?? [])[0], (node.slots.end ?? [])[0])
      const dest = await resolveRange(ctx, (node.slots.dest ?? [])[0], (node.slots.dest ?? [])[0])
      let acc = 0
      for (let i = r.from; i < r.to; i++) {
        acc += numOf(r.arr[i])
        dest.arr[dest.from + (i - r.from)] = { type: 'int', value: acc }
      }
    })
}
