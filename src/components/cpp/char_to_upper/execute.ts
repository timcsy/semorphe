/**
 * `cpp:char_to_upper` 的 **execute** 路（字元轉換）
 *
 * ⚠️ 它原本由 `std/cctype/executors.ts` 的**一個 `for` 迴圈**註冊，
 * 而那讓三顆元件的執行器**來源位置是同一行**——護欄分不出是哪一顆。
 * `charOf` 留在 `core/runtime/char.ts`：那是共用的演算法，不屬於任何一顆。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
import { charOf } from '../../../languages/cpp/core/runtime/char'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:char_to_upper', async (node, ctx) => {
    const c = node.children.value?.[0]
    const v = c ? ((await ctx.evaluate(c)) as RuntimeValue) : null
    if (!v) return { type: 'char', value: '' }
    return { type: 'char', value: charOf(v).toUpperCase() }
  })
}
