/**
 * `cpp:digital_write` 的 **execute** 路。
 *
 * 🔴 **沒有 `pinMode` 就寫，本輪【照做而記下來】**，不擋也不靜默——
 * 理由寫在 `arduino-pins.ts` 的檔頭：出聲會擋住一批真的能跑的入門程式
 * （很多教學範例就是漏了 `pinMode`）。
 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import { requirePin, stateOf } from '../../../languages/cpp/core/runtime/arduino-pins'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:digital_write', async (node, ctx) => {
    const pin = requirePin(ctx.toNumber(await ctx.evaluate((node.children.pin ?? [])[0])))
    const value = ctx.toNumber(await ctx.evaluate((node.children.value ?? [])[0]))
    const state = stateOf(ctx, pin)
    if (state.mode === undefined) state.writtenBeforeMode = true
    // `digitalWrite` 只有高低兩態——非零即高，與真板子一致
    state.value = value === 0 ? 0 : 1
  })
}
