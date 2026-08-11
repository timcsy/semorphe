/**
 * `cpp:char_is_digit` 的 **execute** 路（字元分類）
 *
 * ⚠️ 它原本由 `std/cctype/executors.ts` 的**一個 `for` 迴圈**註冊，
 * 而那讓三顆元件的執行器**來源位置是同一行**——護欄分不出是哪一顆。
 * `charOf` 留在 `core/runtime/char.ts`：那是共用的演算法，不屬於任何一顆。
 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
import { charOf } from '../../../languages/cpp/core/runtime/char'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:char_is_digit', async (node, ctx) => {
    const c = node.children.value?.[0]
    const v = c ? ((await ctx.evaluate(c)) as RuntimeValue) : null
    if (!v) return { type: 'int', value: 0 }
    return { type: 'int', value: /[0-9]/.test(charOf(v)) ? 1 : 0 }
  })
}
