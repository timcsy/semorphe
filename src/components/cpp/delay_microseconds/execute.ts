/**
 * `cpp:delay_microseconds` 的 **execute** 路——推**同一個**時鐘。
 *
 * ⚠️ **微秒換算成毫秒**（÷1000）。模擬時鐘的解析度是毫秒，所以
 * `delayMicroseconds(10)` 推進 0.01 ms——**小於一毫秒的等待 `millis()` 看不見**。
 *
 * 🔴 而那是刻意的，判準在 `digital_read/execute.ts` 的檔頭：
 * > **可重現比擬真重要**——一個每次讀到不同值的模擬器，測不出任何東西。
 *
 * ⚠️ 超音波的 `delayMicroseconds(10)` 觸發脈衝正是這種尺度——它在模擬裡
 * **不會推進可見的時間**，而那不影響 `pulse_read` 的結果（它讀的是腳位狀態）。
 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import { sleepMillis } from '../../../languages/cpp/core/runtime/arduino-clock'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:delay_microseconds', async (node, ctx) => {
    const us = ctx.toNumber(await ctx.evaluate((node.children.us ?? [])[0]))
    await sleepMillis(us / 1000)
  })
}
