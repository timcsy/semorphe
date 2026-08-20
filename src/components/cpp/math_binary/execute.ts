/**
 * `cpp:math_binary` 的 **execute** 路——從 `std/cmath/executors.ts` 原封搬過來。
 *
 * ⚠️ 與 `cpp:math_unary` 同一組不一致：`max`／`min` 認得但 lift 不登錄
 * （它們是 `<algorithm>` 的），而 `default: result = 0` 讓
 * **「算出來是 0」與「不認得這個函式」長得一模一樣**——靜默回退。
 * 搬移不重寫，記在這裡讓它有名字。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:math_binary', async (node, ctx) => {
    const func = String(node.properties.func ?? 'fmod')
    const v1 = ctx.toNumber(await ctx.evaluate((node.children.arg1 ?? [])[0]))
    const v2 = ctx.toNumber(await ctx.evaluate((node.children.arg2 ?? [])[0]))

    let result: number
    switch (func) {
      case 'fmod': result = v1 % v2; break
      case 'fmax': case 'max': result = Math.max(v1, v2); break
      case 'fmin': case 'min': result = Math.min(v1, v2); break
      case 'atan2': result = Math.atan2(v1, v2); break
      case 'hypot': result = Math.hypot(v1, v2); break
      default: result = 0
    }
    return { type: 'double', value: result }
  })
}
