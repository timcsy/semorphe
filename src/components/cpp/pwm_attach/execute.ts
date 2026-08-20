/** `cpp:pwm_attach` 的 **execute** 路——新版一步到位：設定 ＋ 繫腳位。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { boardIn, requirePin } from '../../../languages/cpp/core/runtime/arduino-pins'
import { setupChannel, tiePin } from '../../../languages/cpp/core/runtime/arduino-pwm'

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:pwm_attach', async (node, ctx) => {
    const pin = requirePin(ctx.toNumber(await ctx.evaluate((node.children.pin ?? [])[0])), boardIn(ctx))
    const freq = ctx.toNumber(await ctx.evaluate((node.children.freq ?? [])[0]))
    const bits = ctx.toNumber(await ctx.evaluate((node.children.bits ?? [])[0]))
    // ⚠️ 新版**用腳位號當通道號**——通道由系統自動配置，而 API 的語義就是這個。
    setupChannel(ctx, pin, freq, bits)
    tiePin(ctx, pin, pin)
  })
}
