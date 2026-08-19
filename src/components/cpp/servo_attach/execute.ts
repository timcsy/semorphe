/** `cpp:servo_attach` 的 **execute** 路——記下這顆伺服接在哪根腳位。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import { boardIn, requirePin } from '../../../languages/cpp/core/runtime/arduino-pins'
import { servoOf } from '../../../languages/cpp/core/runtime/arduino-devices'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:servo_attach', async (node, ctx) => {
    const name = String(node.properties.obj ?? 'myServo')
    const pin = requirePin(ctx.toNumber(await ctx.evaluate((node.children.pin ?? [])[0])), boardIn(ctx))
    servoOf(ctx, name).pin = pin
  })
}
