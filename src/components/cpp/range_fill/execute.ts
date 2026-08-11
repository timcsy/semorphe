/** `cpp:range_fill` 的 **execute** 路——從共用檔原封剪過來（批次第八批：io.ts 的帶判別分支（括號形式／方法引數個數消歧））。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import { resolveRange } from '../../../languages/cpp/core/runtime/range'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:range_fill', async (node, ctx) => {
      const r = resolveRange(ctx as never, String(node.properties.begin), String(node.properties.end))
      const v = await ctx.evaluate((node.children.value ?? [])[0])
      for (let i = r.from; i < r.to; i++) r.arr[i] = v
    })
}
