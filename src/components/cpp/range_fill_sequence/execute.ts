/** `cpp:range_fill_sequence` 的 **execute** 路——從共用檔原封剪過來（批次第六批：lift 是 io.ts 的一個帶真邏輯的分支）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import { resolveRange } from '../../../languages/cpp/core/runtime/range'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:range_fill_sequence', async (node, ctx) => {
      const r = resolveRange(ctx as never, String(node.properties.begin), String(node.properties.end))
      const start = ctx.toNumber(await ctx.evaluate((node.children.value ?? [])[0]))
      for (let i = r.from; i < r.to; i++) r.arr[i] = { type: 'int', value: start + (i - r.from) }
    })
}
