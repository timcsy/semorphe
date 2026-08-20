/**
 * `cpp:wifi_read` 的 **execute** 路。
 *
 * 🔴 **這是一個取捨，不是一個模擬**，而理由要說出來：
 *
 * 幾乎每一支 WiFi 教學程式都長這樣：
 *
 * ```cpp
 * WiFi.begin(ssid, password);
 * while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
 * ```
 *
 * ⚠️ 回「未連上」的話**每一支都會卡在那個迴圈裡**，而學生看到的是「程式當掉」
 * ——那對教學比一個樂觀的答案更糟。
 *
 * ⚠️ 而它比同批的溫濕度那顆**弱**：那一顆回 `NaN` 是**官方文件寫明的失敗值**，
 * 而學生的程式本來就會檢查它。這一顆沒有那種依據——
 * **它是為了讓教學程式跑得完而選的**。
 *
 * 🔴 **已知後果**：連線失敗的處理分支永遠走不到。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

/** `WL_CONNECTED` 在 Arduino 的 WiFi 函式庫裡是 3。 */
const WL_CONNECTED = 3

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:wifi_read', async (node) => {
    return node.properties.quantity === 'address'
      ? { type: 'string' as const, value: '192.168.1.100' }
      : { type: 'int' as const, value: WL_CONNECTED }
  })
}
