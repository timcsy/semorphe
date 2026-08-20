/**
 * `cpp:analog_read` 的 **execute** 路。
 *
 * ⚠️ **沒接東西的類比腳位讀回 0**，而真板子會浮動。
 * **可重現比擬真重要**——一個每次讀到不同值的模擬器，測不出任何東西。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { boardIn, requirePin, stateOf } from '../../../languages/cpp/core/runtime/arduino-pins'

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:analog_read', async (node, ctx) => {
    const pin = requirePin(ctx.toNumber(await ctx.evaluate((node.children.pin ?? [])[0])), boardIn(ctx))
    return { type: 'int', value: stateOf(ctx, pin).value }
  })
}
