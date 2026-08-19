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
import type { BoardPinModel } from '../../../../core/types'
import type { ExecutionContext } from '../../../../interpreter/executor-registry'

/**
 * **一塊板子的腳位模型。**
 *
 * 🔴 **它是「是多少」，不是「有沒有」**——所以它不住在 `Target.provides`
 * （那一格是能力，回布林）。
 *
 * > **一個宣告如果同時裝「有沒有」與「是多少」，讀它的每一個消費者
 * > 都要先分辨自己拿到的是哪一種——而那個分辨會在每個消費點各寫一次。**
 *
 * 見 `specs/145-board-pin-model/research.md` R1。
 */
/** 每塊板子都有的：電位與腳位模式。⚠️ 它們不是腳位，是**環境提供的具名常數**。 */
const COMMON_CONSTANTS = { HIGH: 1, LOW: 0, INPUT: 0, OUTPUT: 1, INPUT_PULLUP: 2 } as const

/** Uno／Nano：0–13 數位、14–19 類比（A0–A5）。 */
export type { BoardPinModel }

export const UNO_BOARD: BoardPinModel = {
  name: 'Arduino Uno',
  maxPin: 19,
  constants: { ...COMMON_CONSTANTS, A0: 14, A1: 15, A2: 16, A3: 17, A4: 18, A5: 19 },
}

/** Nano 與 Uno 同一顆 ATmega328P。⚠️ 而驗收**逐塊斷言**，不從 Uno 推論。 */
export const NANO_BOARD: BoardPinModel = { ...UNO_BOARD, name: 'Arduino Nano' }

/**
 * ESP32：GPIO 0–39。
 *
 * ⚠️ **34–39 只能輸入**（沒有輸出驅動器）——而**這一刀不做那一層**：
 * 它需要一個「方向能力」的模型，而今天沒有需求（憲法第一條）。
 * 🔴 所以如果將來要擋 34–39 的輸出，**那是一條新的需求，不是這裡的 bug**。
 *
 * ⚠️ 而它**沒有 `A0`**——ESP32 的類比腳位不叫那個名字。
 */
export const ESP32_BOARD: BoardPinModel = {
  name: 'ESP32',
  maxPin: 39,
  constants: { ...COMMON_CONSTANTS },
}

/** 不指定板子的 `arduino` 目標維持今天的行為（Uno）。 */
export const DEFAULT_BOARD = UNO_BOARD

/** 一個目標的板子模型——⚠️ **省略 ＝ 這個目標沒有板子**（`cpp`／`c`／競程）。 */
export function boardOf(target: { board?: BoardPinModel } | undefined): BoardPinModel | undefined {
  return target?.board
}

export interface PinState {
  /** `INPUT`(0) / `OUTPUT`(1) / `INPUT_PULLUP`(2)；`undefined` = 從來沒設定過 */
  mode?: number
  /** 數位電位或類比值（0–255 for PWM，0–1023 for analogRead） */
  value: number
  /** ⚠️ 有沒有在 `pinMode` 之前就被寫過——給未來的診斷用，本輪沒有消費者 */
  writtenBeforeMode: boolean
  /**
   * 目前正在發出的頻率（Hz）。`undefined` ＝ 沒在發聲。
   *
   * 🔴 **蜂鳴器在模擬裡是【狀態】不是【輸出】。**
   * `ctx.io` 是**程式的輸出**（學生的 `Serial.println` 走同一條），
   * 而把模擬器的旁白寫進那裡，會讓程式的輸出變成錯的——
   * 而輸出比對是這個專案量正確性的方式之一。
   *
   * ⚠️ **已知後果**：學生按執行，蜂鳴器什麼都不會發生。
   * 那是**視圖層**的缺口（板子視圖，階段 6.11 第 4 項，已推遲），
   * **不是用汙染 stdout 去補的**。
   */
  toneHz?: number
  /** 發聲的毫秒數。`undefined` ＝ 沒指定（`tone` 的第三個引數是可選的），一直響到 `noTone`。 */
  toneMs?: number
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
export function requirePin(n: number, board?: BoardPinModel): number {
  return requirePinOn(n, board ?? DEFAULT_BOARD)
}

/**
 * 從**執行脈絡**拿板子——27 個呼叫端因此不必逐一改簽章。
 *
 * 🔴 **這是唯一入口**：消費者問 `ctx`，不自己查目標。
 * ⚠️ 而 `undefined` ＝ 這個目標沒有板子（`cpp`／`c`／競程）→ 退回預設。
 */
export function boardIn(ctx: { board?: BoardPinModel }): BoardPinModel {
  return ctx.board ?? DEFAULT_BOARD
}

function requirePinOn(n: number, board: BoardPinModel): number {
  const pin = Math.trunc(n)
  if (!Number.isFinite(pin) || pin < 0 || pin > board.maxPin) {
    // 🔴 **訊息要說得出是哪一塊板子**——一個裸數字讓學生無從判斷
    //    「是我打錯了」還是「我選錯板子了」。
    throw new Error(`腳位號碼 ${n} 超出範圍——${board.name} 只有 0–${board.maxPin}`)
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

/** ⚠️ 保留給還沒接上板子的呼叫端——**新程式碼請用 `board.maxPin`**。 */
export const MAX_PIN = DEFAULT_BOARD.maxPin

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

  // ── 🔴 套件提供的常數（2026-08-18，第 2／3 批）──────────────────
  //
  // ⚠️ 這張表的名字說「腳位常數」，而它從一開始就不只是腳位
  //（`HIGH`／`OUTPUT` 是模式與電位）。**它真正是「環境提供的具名常數」**
  // ——沒有人在程式裡宣告它們，而它們由建置系統或套件的標頭提供。
  //
  // 🟢 而套件常數落在**完全相同**的判準底下：只在「查不到宣告」之後才問，
  // 所以學生自己 `#define DHT11 99` 的話，他的宣告仍然贏。
  //
  // > **一個名字的意思由誰宣告它決定**——而這張表是「沒有人宣告時」的那一格。
  DHT11: 11, DHT21: 21, DHT22: 22, AM2301: 21,
  // WiFi 的連線狀態碼（Arduino 的 `wl_status_t`）
  WL_IDLE_STATUS: 0, WL_NO_SSID_AVAIL: 1, WL_SCAN_COMPLETED: 2,
  WL_CONNECTED: 3, WL_CONNECT_FAILED: 4, WL_CONNECTION_LOST: 5, WL_DISCONNECTED: 6,
  // ESP32 的 LEDC 解析度上限提示值不放——**沒有人用名字寫它**。
}

/**
 * 認不得回 `undefined`（不是猜一個看起來合理的數）。
 *
 * 🔴 **板子自己的常數優先**——ESP32 沒有 `A0`，而它**必須查不到**
 * 而不是拿到 Uno 的 14。查不到會走既有的「未宣告變數」診斷，
 * 那條路已經會說「你是不是要打 X」。
 *
 * ⚠️ 而**套件常數**（`DHT11`／`WL_*`）是**函式庫給的不是板子給的**
 * ——它們對每塊板子都一樣，所以留在共用表裡。
 */
export function pinConstantValue(name: string, board?: BoardPinModel): number | undefined {
  if (board) {
    const own = board.constants[name]
    if (own !== undefined) return own
    // 板子沒有的**腳位別名**要查不到——而套件常數仍然要查得到。
    if (/^A\d+$/.test(name)) return undefined
  }
  return PIN_CONSTANT_VALUES[name]
}
