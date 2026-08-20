/**
 * `cpp:pwm_write` 的 **execute** 路。
 *
 * 🔴 **第一格是通道還是腳位，查程式自己說過的話**（見 `arduino-pwm.ts` 的檔頭）。
 * ⚠️ 而**設定過通道卻沒接腳位時丟錯**——那是一個真的錯誤，不該安靜地寫到腳位 x。
 *
 * 🟢 值本身走**既有的**腳位狀態，與 `analogWrite` 同一條路——不另寫一套。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { stateOf } from '../../../languages/cpp/core/runtime/arduino-pins'
import { resolveTarget } from '../../../languages/cpp/core/runtime/arduino-pwm'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:pwm_write', async (node, ctx) => {
    const x = ctx.toNumber(await ctx.evaluate((node.children.target ?? [])[0]))
    const duty = ctx.toNumber(await ctx.evaluate((node.children.duty ?? [])[0]))
    const target = resolveTarget(ctx, x)
    if (!target) {
      throw new Error(`PWM 通道 ${x} 設定過了，但沒有接到任何腳位——少了「把腳位接到 PWM 通道」`)
    }
    const state = stateOf(ctx, target.pin)
    if (state.mode === undefined) state.writtenBeforeMode = true
    // 上限由解析度決定：8 位元 → 255、10 位元 → 1023
    const max = 2 ** target.bits - 1
    state.value = Math.max(0, Math.min(max, Math.trunc(duty)))
  })
}
