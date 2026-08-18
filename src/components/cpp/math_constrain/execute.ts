/**
 * `cpp:math_constrain` 的 **execute** 路——夾在範圍內。
 *
 * ⚠️ **真的 `constrain` 是巨集**：`#define constrain(x,a,b) ((x)<(a)?(a):((x)>(b)?(b):(x)))`
 * ——參數會被**求值多次**，所以 `constrain(i++, 0, 10)` 在真板子上會讓 `i` 加好幾次。
 *
 * 🔴 **本輪不模那個副作用**：這裡每個參數只求值一次。
 * 那是一個**已知的差異**，不是疏漏——而它寫在這裡，不是留給下一個人自己發現。
 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:math_constrain', async (node, ctx) => {
    const v = await ctx.evaluate((node.children.value ?? [])[0])
    const lo = await ctx.evaluate((node.children.low ?? [])[0])
    const hi = await ctx.evaluate((node.children.high ?? [])[0])
    const n = ctx.toNumber(v)
    // ⚠️ 回傳**原本那個值**（不是重新包一個 int）——型別要跟著走，
    //    否則 `constrain(2.5, 0, 10)` 會變成整數。
    if (n < ctx.toNumber(lo)) return lo
    if (n > ctx.toNumber(hi)) return hi
    return v
  })
}
