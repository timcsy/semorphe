/**
 * `cpp:servo_write` 的 **execute** 路——**記角度，這是真的狀態**。
 *
 * 🔴 **沒有 `attach` 就轉，本輪照做而記下來**——與 `digital_write` 對
 * 「沒有 `pinMode` 就寫」的處置相同：出聲會擋住一批真的能跑的入門程式。
 * ⚠️ 而角度**夾在 0–180**，與真板子一致。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { servoOf } from '../../../languages/cpp/core/runtime/arduino-devices'

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:servo_write', async (node, ctx) => {
    const name = String(node.properties.obj ?? 'myServo')
    const angle = ctx.toNumber(await ctx.evaluate((node.children.angle ?? [])[0]))
    servoOf(ctx, name).angle = Math.max(0, Math.min(180, Math.trunc(angle)))
  })
}
