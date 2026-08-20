/**
 * `cpp:pair_make` 的 **execute** 路
 *
 * ## ⚠️ 它原本回傳一個**字串**
 *
 * ```ts
 * return { type: 'string', value: `(${fv.value}, ${sv.value})` }   // 舊的
 * ```
 *
 * 那是一個**看起來像 pair 的東西**：印出來很像，而 `p.first` 讀不到
 * ——因為它沒有欄位，它是文字。
 *
 * > **一個把結構壓成顯示字串的值，會在「只被印出來」的測試裡一路通過。**
 *
 * 而這個專案已經記過同一個形狀（`components/元件.md` 那條
 * 「一個要 parse 回結構才能用的字串，就不該是字串」）。
 *
 * 改成 `type: 'object'` ＋ `Map{first, second}`——與 `cpp:pair_declare`
 * 建出來的**同一種形狀**，所以 `struct_at_member` 與 `var_assign`
 * 兩條既有的路直接就通。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:pair_make', async (node, ctx) => {
    const f = node.children.first?.[0]
    const s = node.children.second?.[0]
    const fv: RuntimeValue = f ? await ctx.evaluate(f) : { type: 'int', value: 0 }
    const sv: RuntimeValue = s ? await ctx.evaluate(s) : { type: 'int', value: 0 }
    const fields = new Map<string, RuntimeValue>([
      ['first', fv],
      ['second', sv],
    ])
    return { type: 'object', value: fields, structName: 'pair' }
  })
}
