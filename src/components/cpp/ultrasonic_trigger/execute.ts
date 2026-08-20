/**
 * `cpp:ultrasonic_trigger` 的 **execute** 路——**做那五句真的會做的事**。
 *
 * ⚠️ **不另寫一套語義**：腳位狀態走既有的腳位表、等待走既有的模擬時鐘。
 * 這顆是**五句的簡寫**，不是第六種東西——執行起來也該是。
 *
 * > **一顆預組積木如果在執行期有自己的一套行為，
 * > 那它就不是那幾句的簡寫了，而學生拆開它會看到不一樣的結果。**
 *
 * 🔴 10 微秒在模擬時鐘（毫秒解析度）裡推不動可見的時間——
 * 那是刻意的，判準是「可重現比擬真重要」（見腳位讀取那顆的檔頭）。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { boardIn, requirePin, stateOf } from '../../../languages/cpp/core/runtime/arduino-pins'
import { sleepMillis } from '../../../languages/cpp/core/runtime/arduino-clock'

export function registerExecute(
  register: (component: string, executor: ComponentExecutor) => void,
): void {
  register('cpp:ultrasonic_trigger', async (node, ctx) => {
    const pin = requirePin(ctx.toNumber(await ctx.evaluate((node.children.pin ?? [])[0])), boardIn(ctx))
    const state = stateOf(ctx, pin)
    // ⚠️ 與 digitalWrite 同一條路：沒有 pinMode 就寫，**記下來但不擋**。
    if (state.mode === undefined) state.writtenBeforeMode = true
    state.value = 0
    await sleepMillis(2 / 1000)
    state.value = 1
    await sleepMillis(10 / 1000)
    state.value = 0
  })
}
