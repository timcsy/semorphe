/**
 * **輸出串流的狀態**——`setw`／`setprecision`／`setfill`／`fixed`／`scientific`
 * 設的那幾格，以及輸出那一路怎麼用它們。
 *
 * ## 🔴 為什麼它不住在 `IOSystem`（核心）
 *
 * 「欄寬」「小數位數」「補位的字」是 **C++ 串流的詞彙**。
 * 核心的 `IOSystem` 只知道「寫一段文字」與「讀一行」，而中立性護欄
 *（`audit-neutrality`）盯著「核心不得認得語言的東西」——2026-09-18 它當場
 * 指名過一次（那次是把型別保持寫進了 `languages/cpp` 而執行器住在核心，方向相反）。
 *
 * > **一段程式該住在哪裡，問它講的是誰的詞彙。**
 *
 * ## 🔴 為什麼是 `WeakMap` 而不是模組變數
 *
 * 一次執行一份狀態。模組變數會讓**上一支測試的 `setprecision` 洩漏到下一支**
 * ——而那種污染的症狀是「單獨跑綠、整批跑紅」，最難追。
 *
 * `IOSystem` 的生命週期正好是一次執行，所以拿它當鍵。
 *
 * ## ⚠️ 兩個設定的作用範圍**不一樣**，而那是 C++ 的規矩不是我們的簡化
 *
 * ```
 * setw(n)         只影響【下一個】輸出項，用掉就歸零
 * setprecision(n) 一直有效，直到被改掉
 * setfill(c)      一直有效
 * fixed/scientific 一直有效
 * ```
 */
import type { RuntimeValue } from '../../../../interpreter/types'
import { valueToString } from '../../../../interpreter/types'
import { toFixedHalfEven, toExponentialHalfEven, toSignificant } from '../../../../interpreter/decimal'

export interface StreamState {
  /** 下一項至少佔幾格——**用掉就歸零**（C++ 的 `setw` 就是這樣）。 */
  width: number
  /** 補位用的字元，預設空白。 */
  fill: string
  /** 有效位數／小數位數，看 `notation`。C++ 的預設是 6。 */
  precision: number
  /** 數字的寫法。`default` 是 C 的 `%g`（見 `formatDefaultPrecision`）。 */
  notation: 'default' | 'fixed' | 'scientific'
}

const STATES = new WeakMap<object, StreamState>()

/** 這一次執行的串流狀態——沒有就開一份預設的。 */
export function streamState(io: object): StreamState {
  let s = STATES.get(io)
  if (!s) {
    s = { width: 0, fill: ' ', precision: 6, notation: 'default' }
    STATES.set(io, s)
  }
  return s
}

/**
 * 把一個值變成**要印出去的那串文字**，套用數字的寫法與位數。
 *
 * ⚠️ **不動 `valueToString`**：那一支同時被**變數面板**與型別轉換呼叫，
 *    而那兩處不該受 `cout` 的設定影響。
 *    > **一個被三個地方呼叫的函式，替其中一個加狀態，另外兩個會跟著變。**
 */
export function textForStream(val: RuntimeValue, st: StreamState): string {
  const isNum = (val.type === 'double' || val.type === 'float') && typeof val.value === 'number'
  if (!isNum) return valueToString(val)
  const n = val.value as number
  if (!Number.isFinite(n)) return valueToString(val)
  if (st.notation === 'fixed') return toFixedHalfEven(n, st.precision)
  if (st.notation === 'scientific') return toExponentialHalfEven(n, st.precision)
  /**
   * 🔴 **預設那一路要跟著 `precision` 走**——`setprecision(3)` 之後
   * `cout << 3.14159` 是 `3.14`（三位有效數字），不是六位。
   * ⚠️ 位數是預設值 6 時就交給 `valueToString`，讓那一路只有一份實作。
   */
  if (st.precision === 6) return valueToString(val)
  return toSignificant(n, st.precision)
}


/**
 * 補到欄寬，**並且把欄寬用掉**。
 *
 * ⚠️ C++ 的 `setw` 是**靠右**對齊（預設），所以補的空白在**前面**。
 * ⚠️ 而它**只影響下一項**——`cout << setw(2) << a << b` 的 `b` 不補。
 */
export function padForStream(text: string, st: StreamState): string {
  if (st.width <= 0) return text
  const w = st.width
  st.width = 0
  return text.length >= w ? text : st.fill.repeat(w - text.length) + text
}
