/**
 * **在一堆可見的名字裡，找那個「他大概想打的」。**
 *
 * ## 它從哪來
 *
 * 2026-08-17 用 clangd 當裁判量涵蓋率（階段 6.6 ⑤），缺口只有兩筆，
 * 而其中一筆 clang 給的代號是 **`undeclared_var_use_suggest`**
 * ——`suggest`：clang 會說「你是不是要打 `cout`」。
 * 而**第二課第三步教的正是這件事**（`Score` vs `score`）。
 *
 * ## ⚠️ 這不是「改措辭」，是「加一個事實」
 *
 * `spec 119` 的研究記過：加強錯誤訊息**做了六十年而沒有共識**
 * （Becker 等 2019 回顧 107 篇；2024 年連 LLM 版在 6 個任務只贏 1 個）。
 *
 * > **而這一筆沒有把句子講得更漂亮——它告訴使用者
 * > 【可見範圍裡有一個長得很像的名字】。那是資訊，不是修辭。**
 *
 * ## 🔴 而「不亂猜」比「會猜」重要
 *
 * `experience`：「**一個指錯地方的錯誤訊息，比沒有訊息更糟。**」
 * 所以判準寧可漏，不可錯——**找不到就完全不提，訊息與今天逐字相同**。
 */

/**
 * 距離 1 嗎——而「距離」含**相鄰兩字對調**（Damerau-Levenshtein，不是 Levenshtein）。
 *
 * 🔴 **換位要算，而那是寫測試時才發現的**：`scoer` 與 `score` 在
 * **Levenshtein 下是距離 2**（兩次取代），而它其實是**一次對調**。
 *
 * > **打字打顛倒是最常見的錯法之一，而純 Levenshtein 看不見它。**
 *
 * ⚠️ 而它沒有放寬安全性：長度下限（見下）照樣擋住 `ab` vs `ba`。
 */
function isDistanceOne(a: string, b: string): boolean {
  if (a === b) return false
  const [s, l] = a.length <= b.length ? [a, b] : [b, a]
  if (l.length - s.length > 1) return false

  if (s.length === l.length) {
    // 取代一個字元，或相鄰兩字對調
    const diffs: number[] = []
    for (let i = 0; i < s.length; i++) if (s[i] !== l[i]) { diffs.push(i); if (diffs.length > 2) return false }
    if (diffs.length === 1) return true
    if (diffs.length === 2) {
      const [i, j] = diffs
      return j === i + 1 && s[i] === l[j] && s[j] === l[i] // 對調
    }
    return false
  }
  // 插入／刪除一個字元
  let i = 0
  let j = 0
  let skipped = false
  while (i < s.length && j < l.length) {
    if (s[i] === l[j]) { i++; j++; continue }
    if (skipped) return false
    skipped = true
    j++
  }
  return true
}

/**
 * ⚠️ **長度下限 4 是有理由的，不是隨手挑的。**
 *
 * 長度 ≤3 時，「編輯距離 1」涵蓋掉名字空間的一大塊——`a` 與 `b` 的距離是 1，
 * `ab` 與 `ac` 也是。**在那個尺度上猜，就是亂猜。**
 *
 * 而**大小寫不同**不受這個下限限制：`I` 與 `i` 的信心近乎 100%，
 * 因為它不是「換一個字元」，是**同一個字**。
 */
const MIN_LENGTH_FOR_EDIT_DISTANCE = 4

/**
 * 在 `candidates` 裡找一個與 `name` 近似的。找不到回 `undefined`。
 *
 * **優先序**：大小寫完全相符 > 編輯距離 1。
 * ⚠️ 而同一級裡有多個時取**第一個**——這裡刻意不做更細的排序，
 * 因為「哪一個更像」本身沒有客觀答案，而**猜錯的代價比少講一個高**。
 */
export function findNearMiss(name: string, candidates: Iterable<string>): string | undefined {
  const lower = name.toLowerCase()
  let editMatch: string | undefined

  for (const c of candidates) {
    if (c === name) continue
    if (c.toLowerCase() === lower) return c // 大小寫——最高信心，立刻回
    if (
      editMatch === undefined &&
      name.length >= MIN_LENGTH_FOR_EDIT_DISTANCE &&
      c.length >= MIN_LENGTH_FOR_EDIT_DISTANCE &&
      isDistanceOne(name, c)
    ) {
      editMatch = c
    }
  }
  return editMatch
}
