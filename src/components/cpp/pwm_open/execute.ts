/** `cpp:pwm_open` 的 **execute** 路——只記設定，**不碰任何腳位**。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { setupChannel } from '../../../languages/cpp/core/runtime/arduino-pwm'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:pwm_open', async (node, ctx) => {
    const channel = ctx.toNumber(await ctx.evaluate((node.slots.channel ?? [])[0]))
    const freq = ctx.toNumber(await ctx.evaluate((node.slots.freq ?? [])[0]))
    const bits = ctx.toNumber(await ctx.evaluate((node.slots.bits ?? [])[0]))
    setupChannel(ctx, channel, freq, bits)
  })
}
