/**
 * **模擬時鐘與 `loop()` 的界。**
 *
 * ## 為什麼是模擬時鐘（2026-08-17 使用者拍板）
 *
 * ```
 * 真實時間   delay(1000) 真的等一秒，直觀    🔴 執行不再可重現
 * 模擬時鐘   可重現、可加速                  學生看到的「一秒」是假的
 * ```
 *
 * **拍板：模擬為主，而【可以切成真實時間】。**
 * ⚠️ 而使用者是**在看過這個代價之後**選它的：
 *
 * > 🔴 **兩條路 ＝ 兩份行為，而只有一條會被測到。**
 *
 * 所以這個檔的兩條路**各有一支測試**，而測到幾條要**說得出來**。
 *
 * ## 🔴 `loop()` 的界有兩個，而理由不同
 *
 * ```
 * 模擬時間上限   語義的界——使用者看得懂（「跑 5 秒」）
 *                而 delay(1000)×2 的 sketch，5 秒 ≈ 兩圈半：那個數字【說得出理由】
 * 圈數上限       防卡死的網——一個【沒有 delay 的】loop() 永遠推不動模擬時間，
 *                於是語義的界永遠不會到
 * ```
 *
 * ⚠️ **「跑兩圈」不是一個界，是一個隨手挑的數字**——它說不出「為什麼是兩」。
 * 這兩個都說得出來。
 *
 * ## 這個檔不負責什麼
 *
 * - **不負責腳位**——那是別的膠囊
 * - **不負責 UI 的停止鍵**——那是執行控制器；這裡的界是給**測試與批次執行**的
 */

/** `loop()` 的界。兩個上限的理由見檔頭——**它們不是同一件事**。 */
export interface LoopBudget {
  /** 語義的界：模擬時間走到這裡就停（毫秒） */
  millis: number
  /** 防卡死的網：沒有 `delay` 的 `loop()` 推不動時間，所以還要數圈 */
  maxIterations: number
}

/**
 * 預設 5 秒。
 *
 * ⚠️ **理由**：`delay(1000)` 是入門 Arduino 最常見的節奏，
 * 而 5 秒 ≈ 兩圈半——**看得出「它在重複」，而不必等**。
 */
const DEFAULT_BUDGET: LoopBudget = { millis: 5_000, maxIterations: 100_000 }

let budget: LoopBudget = { ...DEFAULT_BUDGET }
let simulatedNow = 0
let iterations = 0
let realTime = false

/** 一次執行開始——**每次 `execute` 都要叫**，否則上一次的時間會漏過來。 */
export function resetClock(): void {
  simulatedNow = 0
  iterations = 0
}

/** 設定 `loop()` 的界。不傳就回到預設。 */
export function loopBudget(next?: Partial<LoopBudget>): LoopBudget {
  budget = { ...DEFAULT_BUDGET, ...next }
  return budget
}

/**
 * 真實時間模式。
 *
 * 🔴 **這是第二條路，而它的代價是使用者接受過的**：
 * 開著它的時候，執行**不可重現**（`millis()` 回的是牆上時鐘）。
 */
export function useRealTime(on: boolean): void {
  realTime = on
}

export function isRealTime(): boolean {
  return realTime
}

/** `millis()` 讀的東西。 */
export function nowMillis(): number {
  return realTime ? Math.trunc(performance.now()) : simulatedNow
}

/** `delay(ms)` ——模擬模式下**不真的等**，只把時間往前推。 */
export async function sleepMillis(ms: number): Promise<void> {
  const amount = Math.max(0, Math.trunc(ms))
  if (!realTime) {
    simulatedNow += amount
    return
  }
  await new Promise<void>((resolve) => setTimeout(resolve, amount))
}

/**
 * `loop()` 還要不要再跑一圈。
 *
 * ⚠️ **真實時間模式下用的是牆上時鐘**，所以同一個 budget 在兩條路上
 * 會跑出**不同的圈數**——那正是「兩份行為」的具體樣子。
 */
export function tickLoop(): boolean {
  if (iterations >= budget.maxIterations) return false
  if (nowMillis() - (realTime ? realStart : 0) >= budget.millis) return false
  iterations++
  return true
}

let realStart = 0

/** 真實時間模式的起點——`resetClock` 之外另記，因為牆上時鐘不從 0 開始。 */
export function markRealStart(): void {
  realStart = Math.trunc(performance.now())
}

/** 測試用：這一次跑了幾圈。 */
export function loopIterations(): number {
  return iterations
}
