/** `cpp:throw` 的 **execute** 路——從共用檔原封剪過來（批次第一批）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
// ⚠️ **訊號類別必須是同一個**——複製一份的話 `instanceof` 會失敗，
// 而失敗的樣子是「throw 沒有被 catch 接住」，不是編譯錯誤。
//
// `languages/cpp/core/executors/control-flow.ts` **自己複製了一份** `ThrownSignal`
// （就寫在一句警告「複製一份的話 instanceof 會失敗」的正下方），
// 而這兩顆剛好都用那一份，所以沒有爆。`switch` 搬進膠囊後那個檔全空了，
// 兩顆一起改指真正的那一份——**順手把那個複本消滅掉**。
import { ThrownSignal } from '../../../interpreter/executors/control-flow'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:throw', async (node, ctx) => {
      const vals = node.children.value ?? []
      const value = vals.length > 0 ? await ctx.evaluate(vals[0]) : 'exception'
      throw new ThrownSignal(value)
    })
}
