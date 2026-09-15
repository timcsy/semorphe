/**
 * **補丁器往程式碼裡插了幾行，對照表就要跟著挪幾行。**
 *
 * ## 🔴 它從哪來（2026-09-15，使用者：「積木跟程式碼 highlight 的地方對不上，會差一行」）
 *
 * 實測（在 main 裡打一行 `cout`，畫面上每一顆積木會亮哪一行）：
 *
 * ```
 * 1  #include <iostream>     ← 補丁器塞進【文字】的，對照表算完之後才出現
 * 2  using namespace std;    而「使用命名空間」那顆積木亮的是第 1 行
 * 3  int main() {            「定義函式」那顆亮第 2 行
 * 5      cout << "hi" …      「印出」那顆亮第 4 行（`return 0;`）
 * ```
 *
 * 每一顆都早一行，而差的正是那一條 `#include`。
 *
 * > **一份對照表，如果它描述的文字在它算完之後又被動過，
 * > 那它描述的是一份不存在的文字——而它看起來仍然是一份合法的對照表。**
 *
 * ⚠️ 組裝點那個 wrapper **早就算過 `linesDelta`**（給游標保位用），
 * 而沒有人拿它去挪對照表。
 *
 * > **同一個位移被算出來給 A 用，而 B 也需要它——
 * > 那是「已經知道答案而沒有交出去」，不是「還不知道」。**
 *
 * ## 🪦 而第一版把行號當成 1-based，那讓它在每一個情況下都錯
 *
 * `CodeMapping` 是 **0-based**（消費端逐字寫著 `m.startLine + 1`，
 * 因為 Monaco 是 1-based）。第一版拿「行 1」對到第一行、發現「對得上」，
 * 於是我一度判定「對照表本來就是對的」——**而那個結論是用錯的基準得到的**。
 *
 * > **在斷言「這個數字對不對」之前，先去找【誰在用它】
 * > ——基準寫在消費端，不在產生端。**
 *
 * ## 為什麼用「對齊」而不是「問補丁器插了幾行」
 *
 * 因為補丁器不只插行：它還會**把本體整段縮排**（四格），以及在缺進入點時
 * **把鬆散的語句包進 `int main() { … }`**。「插了幾行」答不出後面那兩種。
 *
 * ⚠️ 所以這裡對齊的是**去掉前後空白之後的行內容**——縮排變了仍然對得上。
 *
 * ## ⚠️ 本模組不知道任何語言
 *
 * 它只看兩份文字。哪一行是 `#include`、為什麼要補，都是語言套件的事。
 */
import type { CodeMapping } from './code-generator'

/**
 * `before` 的每一行，在 `after` 裡是第幾行（都是 0-based）；對不上的是 `-1`。
 *
 * 🔴 **用最長共同子序列，不是逐行比**：補丁器可能在中間插入
 * （`using namespace std;` 插在最後一個 `#include` 之後），逐行比會從那裡全錯。
 */
export function alignLines(before: readonly string[], after: readonly string[]): number[] {
  const n = before.length
  const m = after.length
  const a = before.map((l) => l.trim())
  const b = after.map((l) => l.trim())
  // dp[i][j] ＝ a[i..] 與 b[j..] 的最長共同子序列長度
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const out = new Array<number>(n).fill(-1)
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) { out[i] = j; i++; j++ } else if (dp[i + 1][j] >= dp[i][j + 1]) i++
    else j++
  }
  return out
}

/**
 * 把對照表從 `before` 那份文字挪到 `after` 那份上。
 *
 * ⚠️ **行號是 0-based**——見檔頭那個墓碑。
 *
 * ⚠️ 對不上的那一行（空行、或被補丁器改寫過的）**不丟掉**：沿用前一個對得上的行
 * 算出來的位移。丟掉的話那一顆積木會變成「點了沒反應」，而那比差一行更難查。
 *
 * > **一個對不上的映射，誠實的處置是「用最接近的位移」，不是「當作沒有」。**
 */
export function shiftMappings(
  before: string,
  after: string,
  mappings: readonly CodeMapping[],
): CodeMapping[] {
  if (before === after || mappings.length === 0) return [...mappings]
  const bl = before.split('\n')
  const al = after.split('\n')
  const align = alignLines(bl, al)
  // 每一行的位移——對不上的沿用前一個
  const shift = new Array<number>(bl.length).fill(0)
  let last = 0
  for (let k = 0; k < bl.length; k++) {
    if (align[k] >= 0) last = align[k] - k
    shift[k] = last
  }
  const at = (line0: number): number => {
    if (line0 < 0 || line0 >= shift.length) return line0
    return line0 + shift[line0]
  }
  return mappings.map((m) => ({ ...m, startLine: at(m.startLine), endLine: at(m.endLine) }))
}
