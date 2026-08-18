/**
 * `cpp:serial_count` 的 **execute** 路——**模擬環境回 0**。
 *
 * 🔴 而那不是編出來的數字：模擬沒有序列埠輸入來源，所以緩衝區**真的是空的**
 * ——與真板子在沒有人送資料時的行為一致（同 `cpp:pulse_read` 的判準）。
 *
 * 接上真的輸入時（`ctx.awaitInput()` 或一個緩衝區），這裡改成讀那個緩衝區的長度。
 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:serial_count', async () => ({ type: 'int', value: 0 }))
}
