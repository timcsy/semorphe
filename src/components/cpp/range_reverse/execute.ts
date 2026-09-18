/** `cpp:range_reverse` 的 **execute** 路——從共用檔原封剪過來（批次第八批：io.ts 的帶判別分支（括號形式／方法引數個數消歧））。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { resolveRange } from '../../../languages/cpp/lang/runtime/range'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:range_reverse', async (node, ctx) => {
      const r = await resolveRange(ctx, (node.slots.begin ?? [])[0], (node.slots.end ?? [])[0])
      const slice = r.arr.slice(r.from, r.to).reverse()
      for (let i = 0; i < slice.length; i++) r.arr[r.from + i] = slice[i]
    })
}
