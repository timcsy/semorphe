/**
 * 宣告出來的硬體物件在模擬裡的狀態（伺服／液晶／內建記憶體）。
 *
 * ## 🔴 判準：**逐顆問「有沒有誠實的來源」，不要用一條通則蓋過去**
 *
 * `draft/2026-08-17-套件的物件在執行期是什麼.md` 第五節卡在「方法要回傳什麼」，
 * 而它卡住的原因是把所有方法當成同一題。**逐顆問就散開了**：
 *
 * ```
 * servo.write(90)      記角度            🟢 真的狀態
 * servo.read()         回上次寫的角度     🟢 真的可算——不是編出來的
 * EEPROM.read/write    一個位元組陣列     🟢 **完全模擬得了**（它本來就是記憶體）
 * lcd.print(...)       記游標與內容       🟢 真的狀態
 * dht.readHumidity()   回 NaN            🟢 見 `dht_humidity` 的檔頭——那是真板子的行為
 * ```
 *
 * ⚠️ **液晶的內容不進 `ctx.io`**——那是**程式的輸出**（學生的 `Serial.println`
 * 走同一條），把模擬器的旁白寫進去會讓程式的輸出變成錯的。與蜂鳴器同一條判準。
 *
 * ## 形狀
 *
 * 照 `arduino-pins.ts`：**以執行脈絡為鍵的 `WeakMap`**，不是模組層級的單例
 * ——那會讓兩次執行互相汙染。而物件以**變數名**為鍵。
 */
import type { ExecutionContext } from '../../../../interpreter/executor-registry'

/** 一顆伺服馬達。 */
export interface ServoState {
  /** 接在哪根腳位。`undefined` ＝ 還沒 `attach` */
  pin?: number
  /** 目前的角度。⚠️ **它是記住的，不是量出來的** */
  angle: number
}

/** 一片字元液晶。 */
export interface LcdState {
  cols: number
  rows: number
  /** 游標位置 `[col, row]` */
  cursor: [number, number]
  /** 每一列的內容——⚠️ 顯示是視圖層的事，這裡只記 */
  lines: string[]
}

interface DeviceStore {
  servos: Map<string, ServoState>
  lcds: Map<string, LcdState>
  /** 內建記憶體。🟢 Uno 是 1024 個位元組，而**它可以被完整模擬** */
  eeprom: Uint8Array
}

const byContext = new WeakMap<object, DeviceStore>()

function storeOf(ctx: ExecutionContext): DeviceStore {
  let s = byContext.get(ctx as object)
  if (!s) {
    s = { servos: new Map(), lcds: new Map(), eeprom: new Uint8Array(1024) }
    byContext.set(ctx as object, s)
  }
  return s
}

/** 取得（必要時建立）一顆伺服的狀態。 */
export function servoOf(ctx: ExecutionContext, name: string): ServoState {
  const m = storeOf(ctx).servos
  let s = m.get(name)
  if (!s) {
    s = { angle: 0 }
    m.set(name, s)
  }
  return s
}

/** 取得（必要時建立）一片液晶的狀態。 */
export function lcdOf(ctx: ExecutionContext, name: string): LcdState {
  const m = storeOf(ctx).lcds
  let s = m.get(name)
  if (!s) {
    s = { cols: 16, rows: 2, cursor: [0, 0], lines: ['', ''] }
    m.set(name, s)
  }
  return s
}

/** 內建記憶體。🟢 1024 個位元組，全部初始化成 0。 */
export function eepromOf(ctx: ExecutionContext): Uint8Array {
  return storeOf(ctx).eeprom
}

/**
 * 位址檢查。
 *
 * ⚠️ **超出範圍要出聲**，不要靜默截斷——真板子上寫超界會覆蓋到別的位址，
 * 而那是一個學生找不到原因的 bug。
 */
export function requireAddress(addr: number): number {
  const n = Math.trunc(addr)
  if (!Number.isFinite(n) || n < 0 || n >= 1024) {
    throw new Error(`內建記憶體的位址是 0 到 1023，而這裡是 ${String(addr)}`)
  }
  return n
}
