/** `cpp:pwm_tie` 的 **execute** 路——把腳位繫到通道。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { boardIn, requirePin } from '../../../languages/cpp/core/runtime/arduino-pins'
import { tiePin } from '../../../languages/cpp/core/runtime/arduino-pwm'

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:pwm_tie', async (node, ctx) => {
    const pin = requirePin(ctx.toNumber(await ctx.evaluate((node.children.pin ?? [])[0])), boardIn(ctx))
    const channel = ctx.toNumber(await ctx.evaluate((node.children.channel ?? [])[0]))
    tiePin(ctx, pin, channel)
  })
}
