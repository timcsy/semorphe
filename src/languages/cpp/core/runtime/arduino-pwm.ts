/**
 * ESP32 的 PWM（LEDC）在模擬裡的狀態。
 *
 * ## 🔴 為什麼需要它：`ledcWrite` 的第一個參數有兩種意思
 *
 * 查證 Espressif 官方遷移指南：core **3.0 移除**了 `ledcSetup` 與 `ledcAttachPin`，
 * 併成 `ledcAttach(pin, freq, res)`，而 `ledcWrite` 的第一個參數**由通道改成腳位**。
 *
 * ```
 * 2.x   ledcSetup(0, 5000, 8);  ledcAttachPin(4, 0);  ledcWrite(0, 128);   ← 0 是【通道】
 * 3.x   ledcAttach(4, 5000, 8);                       ledcWrite(4, 128);   ← 4 是【腳位】
 * ```
 *
 * ⚠️ **那個差別在程式碼裡看不出來**——`ledcWrite(4, 128)` 兩種讀法都合法。
 *
 * 🟢 **而執行期分得出來**：如果那個數字**被登記成通道**（有人呼叫過
 * `ledcSetup`／`ledcAttachPin`），它就是通道；否則是腳位。
 * **那不是猜，是查程式自己說過的話。**
 *
 * > **一個在語法上分不出來的歧義，未必在執行期也分不出來
 * > ——程式自己稍早可能已經回答過。**
 *
 * ⚠️ 而**兩者都沒登記時當成腳位**（3.x 的行為）——理由是那是今天的板子預設，
 * 而舊版一定會先呼叫 `ledcSetup`。
 *
 * ## 形狀
 *
 * 照 `arduino-pins.ts`／`arduino-clock.ts`：**以執行脈絡為鍵的 `WeakMap`**，
 * 不是模組層級的單例——那會讓兩次執行互相汙染。
 */
// ⚠️ 型別從直譯器來——自己宣告一個結構相容的介面會在**呼叫端**炸，
//    而那是「兩份規格」的最小實例。照 `arduino-pins.ts` 的做法。
import type { ExecutionContext } from '../../../../interpreter/executor-registry'

/** 一個 LEDC 通道的設定。 */
export interface PwmChannel {
  /** 頻率（Hz） */
  freq: number
  /** 解析度（位元）——決定 duty 的上限是 `2^bits - 1` */
  bits: number
  /** 這個通道被繫到哪一根腳位。`undefined` ＝ 還沒 `ledcAttachPin` */
  pin?: number
}

const byContext = new WeakMap<object, Map<number, PwmChannel>>()

/** 這次執行的通道表。 */
export function channelsOf(ctx: ExecutionContext): Map<number, PwmChannel> {
  let m = byContext.get(ctx as object)
  if (!m) {
    m = new Map()
    byContext.set(ctx as object, m)
  }
  return m
}

/** 登記一個通道的設定（`ledcSetup`）。 */
export function setupChannel(ctx: ExecutionContext, channel: number, freq: number, bits: number): void {
  const m = channelsOf(ctx)
  const existing = m.get(channel)
  m.set(channel, { freq, bits, pin: existing?.pin })
}

/** 把腳位繫到通道（`ledcAttachPin`）。 */
export function tiePin(ctx: ExecutionContext, pin: number, channel: number): void {
  const m = channelsOf(ctx)
  const existing = m.get(channel)
  // ⚠️ 先繫再設定也是合法的順序——不要求 `ledcSetup` 先發生。
  m.set(channel, { freq: existing?.freq ?? 0, bits: existing?.bits ?? 8, pin })
}

/**
 * `ledcWrite(x, duty)` 的 `x` 到底是通道還是腳位。
 *
 * 🔴 **查程式自己說過的話**：登記過就是通道，沒登記過就是腳位（3.x）。
 * 回傳「要寫到哪一根腳位」與「解析度幾位元」，⚠️ 而**繫過通道卻沒繫腳位時
 * 回 `null`**——那是一個真的錯誤（設定了通道卻沒接腳位），不該安靜地寫到腳位 x。
 */
export function resolveTarget(
  ctx: ExecutionContext,
  x: number,
): { pin: number; bits: number } | null {
  const ch = channelsOf(ctx).get(x)
  if (!ch) return { pin: x, bits: 8 } // 3.x：x 就是腳位，而預設解析度 8 位元
  if (ch.pin === undefined) return null // 通道設定過但沒接腳位
  return { pin: ch.pin, bits: ch.bits }
}
