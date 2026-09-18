/** `cpp:range_fill_sequence` 的 **execute** 路——從共用檔原封剪過來（批次第六批：lift 是 io.ts 的一個帶真邏輯的分支）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { resolveRange } from '../../../languages/cpp/lang/runtime/range'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:range_fill_sequence', async (node, ctx) => {
      const r = await resolveRange(ctx, (node.slots.begin ?? [])[0], (node.slots.end ?? [])[0])
      const start = ctx.toNumber(await ctx.evaluate((node.slots.value ?? [])[0]))
      for (let i = r.from; i < r.to; i++) r.arr[i] = { type: 'int', value: start + (i - r.from) }
    })
}
