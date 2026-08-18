/**
 * `cpp:servo_read` 的 **execute** 路——**回上次寫進去的角度**。
 *
 * 🟢 這一顆是這批裡**最誠實**的：真板子的 `Servo::read()` 回的也是
 * 「上一次寫進去的值」，而不是量出來的位置。**模擬與真板子在這裡完全一致。**
 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import { servoOf } from '../../../languages/cpp/core/runtime/arduino-devices'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:servo_read', async (node, ctx) => {
    return { type: 'int', value: servoOf(ctx, String(node.properties.obj ?? 'myServo')).angle }
  })
}
