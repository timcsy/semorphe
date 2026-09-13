/**
 * **優先佇列的堆頂** —— 與身分無關的演算法
 *
 * `top()` 與 `pop()` 是兩顆不同的元件，而「哪一顆是堆頂」是同一個問題。
 * 寫兩份會漂移——而漂移的症狀是 `pop()` 拿掉的不是 `top()` 剛給你的那一顆。
 */
import type { RuntimeValue } from '../../../../interpreter/types'

/**
 * 堆頂的索引。空的回 `-1`。
 *
 * ⚠️ **堆序跟著值走**（`heapOrder`），因為比較器寫在宣告上，
 * 而 `top()`／`pop()` 只拿得到變數名。
 */
export function heapTopIndex(cells: RuntimeValue[], order: 'min' | 'max'): number {
  if (cells.length === 0) return -1
  let best = 0
  for (let i = 1; i < cells.length; i++) {
    const a = Number(cells[i].value)
    const b = Number(cells[best].value)
    if (order === 'min' ? a < b : a > b) best = i
  }
  return best
}
