/** `cpp:range_sum` 的 **execute** 路——從共用檔原封剪過來（批次第六批：lift 是 io.ts 的一個帶真邏輯的分支）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import { resolveRange, numOf } from '../../../languages/cpp/std/numeric/executors'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  /**
     * `accumulate(v.begin(), v.end(), init)`
     *
     * ⚠️ **原本是 `async () => ({ type: 'int', value: 0 })`**——一個回傳固定值的
     * 空實作，於是每一個用 `accumulate` 的程式都得到 0 而毫無提示。
     *
     * 而這個殼**就寫在這個檔案裡**「解析不了時擲錯，不回傳『沒事』」
     * 那句話的下面兩行——同一個檔案同時記著教訓與教訓的反例。
     */
    register('cpp:range_sum', async (node, ctx) => {
      const r = resolveRange(ctx as never, String(node.properties.begin), String(node.properties.end))
      const init = (node.children.init ?? [])[0]
      let sum = init ? ctx.toNumber(await ctx.evaluate(init)) : 0
      for (let i = r.from; i < r.to; i++) sum += numOf(r.arr[i])
      return { type: 'int' as const, value: sum }
    })
}
