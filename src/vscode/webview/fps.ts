/**
 * 拖曳的幀間隔量測——**SC-004 要的那個判準住在這裡**。
 *
 * ## 🔴 為什麼要量，而不是看
 *
 * spec SC-004 逐字要求「**寫得出來的判準**」，並且明說
 * 「⚠️ 『看起來還好』**不算**」。
 *
 * 而那條要求有病歷：`history/076` 記過同族的錯——**把「跑完了沒拋錯」
 * 當成「成功」**。「看起來還好」是同一個病的 UI 版本。
 *
 * > **一個由數字算出來的結論，讓「看起來還好」寫不進去。**
 *
 * ## ⚠️ 而這個檔量得到的東西有一個邊界，現在講清楚
 *
 * 它量的是**這個 Webview 所在的引擎**——在 Chromium 裡跑就是 Chromium 的數字，
 * 在 Arduino IDE（Theia／Electron）裡跑才是 Arduino IDE 的數字。
 *
 * 🔴 **兩者不可互相宣稱**。那正是 `history/076` 那個錯的形狀：
 * 在 A 環境驗，宣稱 B 環境成立。
 */
import type * as Blockly from 'blockly'

/** 判準——⚠️ 數字寫死在這裡是刻意的：它就是「判準」本身。 */
const SMOOTH_MEDIAN_MS = 20 // ≈ 50 fps
const SMOOTH_P95_MS = 33 // ≈ 30 fps
const ROUGH_MEDIAN_MS = 33
const ROUGH_P95_MS = 100

export interface DragMeasurement {
  frames: number
  medianMs: number
  p95Ms: number
  maxMs: number
  verdict: '順' | '勉強' | '不順'
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0
  const i = Math.min(sorted.length - 1, Math.floor(q * sorted.length))
  return sorted[i]
}

/**
 * 由數字算出結論。
 *
 * 🔴 **這個函式沒有參數讓人「覺得」它順**——三個門檻都是常數。
 */
export function verdictOf(medianMs: number, p95Ms: number): DragMeasurement['verdict'] {
  if (medianMs <= SMOOTH_MEDIAN_MS && p95Ms <= SMOOTH_P95_MS) return '順'
  if (medianMs > ROUGH_MEDIAN_MS || p95Ms > ROUGH_P95_MS) return '不順'
  return '勉強'
}

export function summarise(intervals: number[]): DragMeasurement {
  const sorted = [...intervals].sort((a, b) => a - b)
  const medianMs = quantile(sorted, 0.5)
  const p95Ms = quantile(sorted, 0.95)
  return {
    frames: intervals.length,
    medianMs,
    p95Ms,
    maxMs: sorted.length > 0 ? sorted[sorted.length - 1] : 0,
    verdict: verdictOf(medianMs, p95Ms),
  }
}

/**
 * 掛上量測：拖曳開始時開始記幀，結束時算出結論。
 *
 * ⚠️ 用 `requestAnimationFrame` 的**間隔**，不是 Blockly 的事件次數
 * ——後者只說「動了幾次」，不說「畫面跟不跟得上」。
 */
export function attachDragMeter(
  workspace: Blockly.WorkspaceSvg,
  onMeasure: (m: DragMeasurement) => void,
): void {
  let intervals: number[] = []
  let last = 0
  let raf = 0
  let dragging = false

  const tick = (now: number): void => {
    if (!dragging) return
    if (last > 0) intervals.push(now - last)
    last = now
    raf = requestAnimationFrame(tick)
  }

  workspace.addChangeListener((e: Blockly.Events.Abstract) => {
    if (e.type !== 'drag') return
    // Blockly 12 的 drag 事件帶 `isStart`
    const isStart = (e as unknown as { isStart?: boolean }).isStart === true
    if (isStart) {
      dragging = true
      intervals = []
      last = 0
      raf = requestAnimationFrame(tick)
      return
    }
    dragging = false
    cancelAnimationFrame(raf)
    onMeasure(summarise(intervals))
  })
}
