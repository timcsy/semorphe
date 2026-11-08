/**
 * **板子做了什麼**（spec 184，重構階段 5c）——判決帶出的腳位變化與結束時的硬體狀態，以及課文的腳位事件怎麼比。
 *
 * 形狀照 `@cella-lang/arduino` README〈Verdicts〉：`pins` 是每一次腳位值的變化 `{t, pin, value}`
 * （`t` 是模擬的毫秒、`pin` 是板子上的號碼——`LED_BUILTIN` 已經換成 13、`value` 有 PWM 時是工作週期）；
 * 最多 1000 筆，`pinsTruncated` 說後面還有沒有。`env` 是結束時的硬體（判決 JSON 裡它是一段 JSON 字串）。
 * ⚠️ 核心只認形狀，不認識提供者。
 */

export interface PinChange { t: number; pin: number; value: number }

export interface HardwareState {
  clockUs: number
  loops: number
  pins: { pin: number; mode: string; level: number; pwm: number | null; toneHz: number | null }[]
  servos: { name: string; pin: number; angle: number }[]
  lcds: { name: string; lines: string[] }[]
  eeprom: unknown[]
}

export interface HardwareRecord {
  changes: PinChange[]
  truncated: boolean
  /** 結束時的硬體；判決沒給（或給的讀不懂）時是 null。 */
  end: HardwareState | null
  /**
   * **為什麼停下**（使用者 11-07 的決定：結束時要說停的原因）——板子上的程式本來就不會自己結束：
   * `simulated` 模擬跑到上限就停（真的板子會一直跑）；`fuel` 步數用完；`error` 執行期出錯（`detail` 是問題種類）。
   */
  stop: { kind: 'simulated' | 'fuel' | 'error'; detail?: string }
}

/** 判決 JSON → 硬體紀錄。不是板子上的程式（沒有 `pins`）回 null。 */
export function hardwareOf(verdict: { pins?: unknown; pinsTruncated?: unknown; env?: unknown; verdict?: unknown; problems?: unknown } | null): HardwareRecord | null {
  if (!verdict || !Array.isArray(verdict.pins)) return null
  let end: HardwareState | null = null
  try {
    const e = typeof verdict.env === 'string' ? JSON.parse(verdict.env) : verdict.env
    if (e && typeof e === 'object') end = e as HardwareState
  } catch { /* 讀不懂就當沒有 */ }
  return { changes: verdict.pins as PinChange[], truncated: verdict.pinsTruncated === true, end, stop: stopOf(verdict) }
}

/**
 * 課文的腳位事件（`check.pins`）：只寫關鍵事件，帶容許誤差（第 18 題）。
 * `t` 省略 ⟹ 不比時間，只要求這個變化照順序發生。
 */
export interface PinEvent { pin: number; value: number; t?: number; tolerance?: number }

export const DEFAULT_PIN_TOLERANCE_MS = 50

export type PinMatch =
  | { ok: true }
  | { ok: false; index: number; expected: PinEvent; found: PinChange | null; why: 'missing' | 'time' }

/**
 * 照順序比：每一個期望的事件，從上一個對上的位置之後，找第一個同腳同值的變化；時間在誤差內才算。
 * 找不到同腳同值 ⟹ missing；找到但時間不對 ⟹ time（附那一筆，訊息說得出實際是幾毫秒）。
 */
export function matchPinEvents(expected: readonly PinEvent[], changes: readonly PinChange[]): PinMatch {
  let from = 0
  for (let i = 0; i < expected.length; i++) {
    const e = expected[i]
    const tol = e.tolerance ?? DEFAULT_PIN_TOLERANCE_MS
    const k = changes.findIndex((c, j) => j >= from && c.pin === e.pin && c.value === e.value)
    if (k < 0) return { ok: false, index: i, expected: e, found: null, why: 'missing' }
    if (e.t !== undefined && Math.abs(changes[k].t - e.t) > tol) return { ok: false, index: i, expected: e, found: changes[k], why: 'time' }
    from = k + 1
  }
  return { ok: true }
}

/** 判決 → 停下的原因（見 `HardwareRecord.stop`） */
function stopOf(verdict: { verdict?: unknown; problems?: unknown }): HardwareRecord['stop'] {
  const problems = Array.isArray(verdict.problems) ? (verdict.problems as { kind?: unknown }[]) : []
  if (problems.some((p) => p.kind === 'fuel')) return { kind: 'fuel' }
  const bad = problems.find((p) => typeof p.kind === 'string' && (p.kind.startsWith('ub') || verdict.verdict === 'reject'))
  if (verdict.verdict === 'reject' || bad) return { kind: 'error', detail: String(bad?.kind ?? 'reject') }
  return { kind: 'simulated' }
}

/** 停下時還開著的輸出腳：OUTPUT 而且 HIGH、PWM 大於 0、或正在發聲——真的板子上它們會一直維持那個狀態 */
export function outputsStillOn(state: HardwareState): HardwareState['pins'] {
  return (state.pins ?? []).filter((p) => p.mode === 'OUTPUT' && (p.level !== 0 || (p.pwm ?? 0) > 0 || (p.toneHz ?? 0) > 0))
}
