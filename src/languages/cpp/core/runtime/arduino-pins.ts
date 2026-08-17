/**
 * **腳位狀態機**——Arduino 與一般 C++ 的唯一實質差別。
 *
 * ## ⚠️ 它為什麼住在語言套件，而不是 `ExecutionContext`
 *
 * `src/interpreter` 在中立性護欄的 `NEUTRAL_DIRS` 裡（基線 `total: 0`）
 * ——**核心不得認識「腳位」這種語言／領域專屬的東西**。
 *
 * 而 `ExecutionContext` 的欄位註解已經寫好了做法：
 *
 * > 「**由語言套件安裝**……沒安裝時行為與加入本機制之前完全相同。」
 *
 * 所以這裡照 `installLambda(ctx)` 的形狀：**執行到腳位概念時才裝**。
 *
 * ## 🔴 沒有 `pinMode` 就 `digitalWrite` 會怎樣
 *
 * 真板子上那是**未定義行為**（腳位預設是輸入，寫進去只會打開內部提升電阻）。
 *
 * **本輪的處置：照做，而記下「它沒有被設定過」。**
 * 理由：出聲會擋住一批**真的能跑**的入門程式（很多教學範例就是漏了 `pinMode`），
 * 而靜默照做又讓學生學不到。→ **記狀態、不擋**，
 * ⚠️ **而那個狀態是給未來的診斷系統用的**——本輪沒有消費者。
 *
 * > **一個「先記下來、之後才有人讀」的欄位，是「機制有了沒人接上」的溫床。**
 * > 所以它**不是新機制**，只是狀態機裡的一個布林，而它有測試釘著。
 *
 * ## 腳位號碼的界
 *
 * Uno 有 0–13 數位 ＋ A0–A5（＝14–19）。**超出就出聲**——
 * `digitalWrite(999, HIGH)` 在真板子上什麼都不會發生，
 * 而**那正是最難查的那種錯**。
 */
import type { ExecutionContext } from '../../../../interpreter/executor-registry'

/** Uno 的腳位範圍：0–13 數位、14–19 類比（A0–A5）。 */
const MAX_PIN = 19

export interface PinState {
  /** `INPUT`(0) / `OUTPUT`(1) / `INPUT_PULLUP`(2)；`undefined` = 從來沒設定過 */
  mode?: number
  /** 數位電位或類比值（0–255 for PWM，0–1023 for analogRead） */
  value: number
  /** ⚠️ 有沒有在 `pinMode` 之前就被寫過——給未來的診斷用，本輪沒有消費者 */
  writtenBeforeMode: boolean
}

/** 一次執行的腳位狀態。⚠️ **不是模組層級的單例**——那會讓兩次執行互相汙染。 */
const pinsByContext = new WeakMap<object, Map<number, PinState>>()

/** 惰性安裝——照 `installLambda(ctx)` 的形狀。 */
export function pinsOf(ctx: ExecutionContext): Map<number, PinState> {
  let pins = pinsByContext.get(ctx as object)
  if (!pins) {
    pins = new Map()
    pinsByContext.set(ctx as object, pins)
  }
  return pins
}

/**
 * 檢查腳位號碼。
 *
 * 🔴 **超出範圍要出聲**——在真板子上它是靜默的無效操作，
 * 而**一個什麼都不做又不出聲的呼叫，是最難查的那種錯**。
 */
export function requirePin(n: number): number {
  const pin = Math.trunc(n)
  if (!Number.isFinite(pin) || pin < 0 || pin > MAX_PIN) {
    throw new Error(`腳位號碼 ${n} 超出範圍——這塊板子只有 0–${MAX_PIN}（A0–A5 是 14–19）`)
  }
  return pin
}

export function stateOf(ctx: ExecutionContext, pin: number): PinState {
  const pins = pinsOf(ctx)
  let s = pins.get(pin)
  if (!s) {
    s = { value: 0, writtenBeforeMode: false }
    pins.set(pin, s)
  }
  return s
}

export { MAX_PIN }

/**
 * 腳位常數的值——🔴 **只在「這個名字沒有被宣告」時才用得上。**
 *
 * `HIGH`／`LOW`／`INPUT`／`OUTPUT` 是**最常見的列舉成員名**，
 * 所以「看到這個名字就當成腳位常數」會把使用者宣告的東西搶走
 * （實測：`enum Level { LOW = -1 };` 的 `cout << LOW` 印成 0 而不是 -1）。
 *
 * > **一個名字的意思由誰宣告它決定。**
 *
 * → 這張表由 `cpp:var_ref` 在**查不到宣告之後**才問。
 */
const PIN_CONSTANT_VALUES: Record<string, number> = {
  HIGH: 1, LOW: 0,
  INPUT: 0, OUTPUT: 1, INPUT_PULLUP: 2,
  A0: 14, A1: 15, A2: 16, A3: 17, A4: 18, A5: 19,
}

/** 認不得回 `undefined`（不是猜一個看起來合理的數）。 */
export function pinConstantValue(name: string): number | undefined {
  return PIN_CONSTANT_VALUES[name]
}
