/**
 * `cpp:dht_read` 的 **execute** 路——🔴 **回 `NaN`，而那是【真板子的行為】**。
 *
 * ## 為什麼 NaN 不是投降
 *
 * 查證（Adafruit DHT 函式庫的官方 issue ＋ 多份教學）：讀取失敗（逾時／校驗錯）時
 * `readHumidity()`／`readTemperature()` **回 NaN**，而**教材一律教學生寫**：
 *
 * ```cpp
 * float h = dht.readHumidity();
 * if (isnan(h)) { Serial.println("Failed to read from DHT sensor!"); return; }
 * ```
 *
 * ⚠️ **而模擬環境就是「沒有接感測器」**——回 NaN 與真板子在那個情境下**完全一致**。
 * 判準與「量脈衝寬度沒接東西回 0」相同：**回的不是編出來的數字**。
 *
 * 🟢 而它**不是**「回 NaN 而不出聲」那個反模式：學生的程式**本來就會檢查它**，
 * 而檢查會成功——**那條路徑因此真的被走到了**。
 * 🔴 編一個「25 度」出來才是那個反模式：學生會以為他量到了溫度。
 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:dht_read', async () => {
    return { type: 'double', value: Number.NaN }
  })
}
