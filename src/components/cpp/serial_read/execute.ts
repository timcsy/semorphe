/**
 * `cpp:serial_read` 的 **execute** 路——**沒有資料時回 `-1`，不是 0**。
 *
 * ## 🔴 那個 -1 是重點，不是細節
 *
 * 它是真板子的行為，也是 Arduino 初學者最常見的陷阱之一：
 *
 * ```cpp
 * if (Serial.read()) { … }   // ⚠️ 沒有資料時 read() 回 -1，而 -1 是【真】
 * ```
 *
 * 回 0 的話那個陷阱就消失了——**而一個把陷阱藏起來的模擬器，
 * 會讓學生在真板子上第一次遇到它**。
 *
 * ⚠️ 模擬環境沒有序列埠輸入來源，所以它一律回 -1
 * ——與真板子在沒有資料時一致（同 `cpp:pulse_read` 的判準）。
 *
 * 接上真的輸入時（`ctx.awaitInput()` 或一個緩衝區），這裡改成讀一個位元組。
 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:serial_read', async () => ({ type: 'int', value: -1 }))
}
