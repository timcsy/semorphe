/** `cpp:range_fill` 的 **execute** 路——從共用檔原封剪過來（批次第八批：io.ts 的帶判別分支（括號形式／方法引數個數消歧））。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { resolveRange } from '../../../languages/cpp/lang/runtime/range'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:range_fill', async (node, ctx) => {
      const r = await resolveRange(ctx, (node.slots.begin ?? [])[0], (node.slots.end ?? [])[0])
      const v = await ctx.evaluate((node.slots.value ?? [])[0])
      for (let i = r.from; i < r.to; i++) r.arr[i] = v
    })
}
