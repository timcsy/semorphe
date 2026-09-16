/** `cpp:math_max` 的 **execute** 路——從共用檔原封剪過來（批次第六批：lift 是 io.ts 的一個帶真邏輯的分支）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:math_max', async (node, ctx) => {
      const a = node.slots.a?.[0]
      const b = node.slots.b?.[0]
      const va = a ? await ctx.evaluate(a) : { type: 'int' as const, value: 0 }
      /**
       * 🔴 **`max({a, b, c})` 只有一個引數**（C++11 的 initializer_list 形式）。
       *
       * 在此之前這裡把缺席的第二個引數當成 0，然後拿一個**陣列**去比大小
       * ——`toNumber(陣列)` 沒有意義，於是它把那個陣列原封回傳，
       * 而畫面上印出 `[array]`（實測 218 支學生程式裡 4 支）。
       *
       * > **一個「引數少了就補預設值」的分支，遇到「這個寫法本來就只有一個引數」
       * > 的時候，補的是一個不存在的問題的答案。**
       */
      if (!b && va.type === 'array' && Array.isArray(va.value) && va.value.length > 0) {
        const items = va.value as import('../../../interpreter/types').RuntimeValue[]
        return items.reduce((p, q) => (ctx.toNumber(q) > ctx.toNumber(p) ? q : p))
      }
      const vb = b ? await ctx.evaluate(b) : { type: 'int' as const, value: 0 }
      const na = ctx.toNumber(va)
      const nb = ctx.toNumber(vb)
      return na >= nb ? va : vb
    })
}
