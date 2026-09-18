/**
 * **優先佇列的堆頂** —— 與身分無關的演算法
 *
 * `top()` 與 `pop()` 是兩顆不同的元件，而「哪一顆是堆頂」是同一個問題。
 * 寫兩份會漂移——而漂移的症狀是 `pop()` 拿掉的不是 `top()` 剛給你的那一顆。
 */
import type { RuntimeValue } from '../../../../interpreter/types'
import type { ExecutionContext } from '../../../../interpreter/executor-registry'
import { lessWithOverload } from './order'

/**
 * 堆頂的索引。空的回 `-1`。
 *
 * ⚠️ **堆序跟著值走**（`heapOrder`），因為比較器寫在宣告上，
 * 而 `top()`／`pop()` 只拿得到變數名。
 */
export async function heapTopIndex(
  cells: RuntimeValue[], order: 'min' | 'max', ctx: ExecutionContext,
): Promise<number> {
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
    /**
     * 🔴 **而「小於」要問使用者自己的 `operator<`**（2026-09-18，語料 2 支）。
     *
     * `priority_queue<side>` 的 `side` 自己定義了 `operator<`（而且是反向的：
     * `return w > b.w;`——競賽裡把大根堆變成小根堆的標準寫法）。
     * 只問 `defaultLess` 的話**每一格都比不出來**，堆頂永遠是第 0 格。
     *
     * ⚠️ 排序、去重、查找三條 2026-09-18 早上就改問這一份了，而**堆這一條漏掉**。
     * > **一個機制的消費者少一個，那個機制就對那條路徑不存在。**
     */
    const a = cells[i]
    const b = cells[best]
    if (order === 'min' ? await lessWithOverload(a, b, ctx) : await lessWithOverload(b, a, ctx)) best = i
  }
  return best
}
