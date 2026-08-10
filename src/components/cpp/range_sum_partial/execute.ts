/** `cpp:range_sum_partial` 的 **execute** 路——從共用檔原封剪過來（批次第六批：lift 是 io.ts 的一個帶真邏輯的分支）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import { resolveRange, numOf } from '../../../languages/cpp/std/numeric/executors'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:range_sum_partial', async (node, ctx) => {
      const r = resolveRange(ctx as never, String(node.properties.begin), String(node.properties.end))
      const dest = resolveRange(ctx as never, String(node.properties.dest), String(node.properties.dest))
      let acc = 0
      for (let i = r.from; i < r.to; i++) {
        acc += numOf(r.arr[i])
        dest.arr[dest.from + (i - r.from)] = { type: 'int', value: acc }
      }
    })
}
