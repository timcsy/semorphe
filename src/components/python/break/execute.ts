/**
 * `python:break` 的 **execute** 路——**丟訊號**。
 *
 * ⚠️ 跳出去的是【哪一個迴圈】由執行期的巢狀決定，而樹上表達不出那條邊——所以用丟訊號，由最近的迴圈接住。
 *
 * 🔴 這一顆是**盲測抓到的**（2026-08-21，`fuzz_05`／`fuzz_07`）：
 * 在它存在之前，`break` 降級成灰色積木——**降級本身是誠實的**，
 * 而執行到那顆積木時整支程式當場中止。
 * > **一個誠實的降級，在【執行】那一路上仍然是一個中止。**
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { BreakSignal } from '../../../interpreter/executors/control-flow'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:break', async () => { throw new BreakSignal() })
}
