/**
 * `cpp:touch_read` 的 **execute** 路——**一個取捨，不是一個模擬**。
 *
 * 沒有真的觸摸感應器。ESP32 未觸碰時的典型讀數約 70–80，這裡回**固定的 75**。
 *
 * ⚠️ 而它比同批的溫濕度那顆**弱**：那一顆回 `NaN` 是**官方文件寫明的失敗值**，
 * 而學生的程式本來就會 `if (isnan(h))` 檢查它——**那條分支因此真的被走到**。
 * 這一顆沒有那種依據，回的只是一個代表性的數字。
 *
 * 🔴 **已知後果**：`if (touchRead(4) < 40)` 這條分支**永遠走不到**。
 * 那是板子視圖（已推遲）要補的，**不是用一個隨機數去假裝的**——
 * 判準是 `digital_read` 檔頭那句：**可重現比擬真重要**。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { boardIn, requirePin } from '../../../languages/cpp/core/runtime/arduino-pins'

/** ESP32 未觸碰時的典型讀數。 */
const UNTOUCHED = 75

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:touch_read', async (node, ctx) => {
    requirePin(ctx.toNumber(await ctx.evaluate((node.children.pin ?? [])[0])), boardIn(ctx))
    return { type: 'int', value: UNTOUCHED }
  })
}
