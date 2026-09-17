/**
 * **優先佇列的堆頂** —— 與身分無關的演算法
 *
 * `top()` 與 `pop()` 是兩顆不同的元件，而「哪一顆是堆頂」是同一個問題。
 * 寫兩份會漂移——而漂移的症狀是 `pop()` 拿掉的不是 `top()` 剛給你的那一顆。
 */
import type { RuntimeValue } from '../../../../interpreter/types'
import { defaultLess } from './order'

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
    /**
     * 🔴 **用同一份「小於」**（2026-09-18）——在此之前這裡寫 `Number(cell.value)`，
     * 而一個 `pair` 的 `value` 是一張 `Map`：`Number(Map)` 是 `NaN`，
     * **每一次比較都是 false，於是堆頂永遠是第 0 格**（也就是先推進去的那一個）。
     *
     * ⚠️ 它一直沒被發現，是因為在 `priority_queue<pair<…>>` 記得住元素型別之前，
     * 那些元素根本不是一對——`Number` 剛好拿得到數字。
     *
     * > **一個「把值壓成數字」的比較，會在那個值終於長對的那天開始答錯。**
     *
     * 🟢 `defaultLess` 是排序、去重、查找共用的那一份，而它對一對值是字典序。
     */
    const a = cells[i]
    const b = cells[best]
    if (order === 'min' ? defaultLess(a, b) : defaultLess(b, a)) best = i
  }
  return best
}
