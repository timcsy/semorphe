/**
 * `cpp:micros` 的 **execute** 路——讀**同一個**時鐘。
 *
 * ⚠️ **精度只有毫秒級**。模擬時鐘 `nowMillis()` 的解析度是毫秒，
 * 這裡 ×1000 換成微秒——所以 `micros()` 的低三位永遠是 0。
 *
 * 🔴 而那是刻意的，判準在 `digital_read/execute.ts` 的檔頭：
 * > **可重現比擬真重要**——一個每次讀到不同值的模擬器，測不出任何東西。
 *
 * ⚠️ **真板子約 70 分鐘會溢位回 0，模擬不模它**——需要教溢位時要另外處理。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { nowMillis } from '../../../languages/cpp/core/runtime/arduino-clock'

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:micros', async () => ({ type: 'int', value: nowMillis() * 1000 }))
}
