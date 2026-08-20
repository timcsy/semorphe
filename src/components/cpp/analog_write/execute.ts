/**
 * `cpp:analog_write` 的 **execute** 路。
 *
 * 🔴 **只存值，不模擬 PWM 波形**——那是一個**刻意的簡化**。
 * 真板子上 `analogWrite(9, 128)` 是以約 490Hz 輸出 50% 工作週期的方波，
 * 而模擬它需要一個時間維度的訊號模型（那是第 5 項接線才需要的東西）。
 *
 * ⚠️ **後果是：`analogWrite` 之後 `digitalRead` 讀到的是那個原始數值的高低判定**，
 * 而不是「平均電位」。本輪接受這個差異。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { boardIn, requirePin, stateOf } from '../../../languages/cpp/core/runtime/arduino-pins'

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:analog_write', async (node, ctx) => {
    const pin = requirePin(ctx.toNumber(await ctx.evaluate((node.children.pin ?? [])[0])), boardIn(ctx))
    const value = ctx.toNumber(await ctx.evaluate((node.children.value ?? [])[0]))
    const state = stateOf(ctx, pin)
    if (state.mode === undefined) state.writtenBeforeMode = true
    state.value = Math.max(0, Math.min(255, Math.trunc(value)))
  })
}
