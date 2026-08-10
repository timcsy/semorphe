/**
 * `cpp:math_unary` 的 **execute** 路——從 `std/cmath/executors.ts` 原封搬過來。
 *
 * ## ⚠️ 兩處與 lift 名單不一致，**照原樣搬**
 *
 * - `'abs'` 認得，但 lift 不登錄它（`abs` 是 `<cstdlib>` 的整數版）
 * - `default: result = v`——**認不得的函式名把輸入原樣回傳**，
 *   那是靜默回退：`unknown(3)` 得到 3，看起來像算對了。
 *
 * 兩者都不是這次搬家造成的，也不在這次的 diff 裡改
 * （搬移不重寫；要改是另一個 commit）。記在這裡是為了讓它**有名字**。
 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:math_unary', async (node, ctx) => {
    const func = String(node.properties.func ?? 'abs')
    const v = ctx.toNumber(await ctx.evaluate((node.children.value ?? [])[0]))

    let result: number
    switch (func) {
      case 'abs': case 'fabs': result = Math.abs(v); break
      case 'sqrt': result = Math.sqrt(v); break
      case 'ceil': result = Math.ceil(v); break
      case 'floor': result = Math.floor(v); break
      case 'round': result = Math.round(v); break
      case 'log': result = Math.log(v); break
      case 'log2': result = Math.log2(v); break
      case 'log10': result = Math.log10(v); break
      case 'exp': result = Math.exp(v); break
      case 'sin': result = Math.sin(v); break
      case 'cos': result = Math.cos(v); break
      case 'tan': result = Math.tan(v); break
      case 'asin': result = Math.asin(v); break
      case 'acos': result = Math.acos(v); break
      case 'atan': result = Math.atan(v); break
      case 'trunc': result = Math.trunc(v); break
      case 'cbrt': result = Math.cbrt(v); break
      default: result = v
    }
    return { type: 'double', value: result }
  })
}
