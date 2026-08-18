/** `cpp:pwm_tie` 的 **execute** 路——把腳位繫到通道。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import { requirePin } from '../../../languages/cpp/core/runtime/arduino-pins'
import { tiePin } from '../../../languages/cpp/core/runtime/arduino-pwm'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:pwm_tie', async (node, ctx) => {
    const pin = requirePin(ctx.toNumber(await ctx.evaluate((node.children.pin ?? [])[0])))
    const channel = ctx.toNumber(await ctx.evaluate((node.children.channel ?? [])[0]))
    tiePin(ctx, pin, channel)
  })
}
