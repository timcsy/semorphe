/**
 * `python:continue` 的 **execute** 路——**丟訊號**。
 *
 * ⚠️ 與跳出迴圈同一個形狀：它是一條跳躍的邊，而樹只有父子關係。
 *
 * 🔴 這一顆是**盲測抓到的**（2026-08-21，`fuzz_05`／`fuzz_07`）：
 * 在它存在之前，`continue` 降級成灰色積木——**降級本身是誠實的**，
 * 而執行到那顆積木時整支程式當場中止。
 * > **一個誠實的降級，在【執行】那一路上仍然是一個中止。**
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { ContinueSignal } from '../../../interpreter/executors/control-flow'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:continue', async () => { throw new ContinueSignal() })
}
