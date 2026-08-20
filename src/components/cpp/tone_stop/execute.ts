/**
 * `cpp:tone_stop` 的 **execute** 路——清掉腳位上的頻率。
 *
 * ⚠️ 與發聲那一顆**共用同一份腳位狀態**，否則「停了沒有」問不出來。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { boardIn, requirePin, stateOf } from '../../../languages/cpp/core/runtime/arduino-pins'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:tone_stop', async (node, ctx) => {
    const pin = requirePin(ctx.toNumber(await ctx.evaluate((node.children.pin ?? [])[0])), boardIn(ctx))
    const state = stateOf(ctx, pin)
    state.toneHz = undefined
    state.toneMs = undefined
  })
}
