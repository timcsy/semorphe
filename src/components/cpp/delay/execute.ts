/**
 * `cpp:delay` 的 **execute** 路——接**既有的**模擬時鐘。
 *
 * 🔴 **模擬模式下它不真的等**，只把時間往前推。
 * 而使用者拍板「模擬為主、可切真實」時**看過那個代價**：
 * > 兩條路 ＝ 兩份行為，而只有一條會被測到。
 * 所以兩條路各有一支測試（見 `arduino-clock.spec` 與本檔）。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { sleepMillis } from '../../../languages/cpp/core/runtime/arduino-clock'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:delay', async (node, ctx) => {
    await sleepMillis(ctx.toNumber(await ctx.evaluate((node.children.ms ?? [])[0])))
  })
}
