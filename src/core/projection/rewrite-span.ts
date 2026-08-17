/**
 * 一次修改**真正要覆蓋的那一段** —— 去頭去尾，中間就是範圍。
 *
 * ## 它從哪來
 *
 * `history/080`§六 給「範圍編輯」留了一個觸發條件，逐字：
 *
 * > 觸發　量一件事：【一次積木編輯平均動到幾行】
 * > 　　　多數是一兩行 → 範圍編輯的收益很大，值得做
 *
 * 2026-08-17 量了（20 段典型 Arduino 語料）：
 *
 * ```
 * 欄位編輯 407 筆   中位 1 行｜p90 1 行｜≤1 行 99.5%
 * 結構編輯  80 筆   中位 1 行｜p90 3 行｜≤1 行 90.0%
 * 跨距 > 半個檔案：0 筆
 * ```
 *
 * **觸發了，而且不是勉強觸發。**
 *
 * ## 🔴 為什麼是「單一範圍」而不是 diff
 *
 * 範圍編輯做的是**一次** `replace(range, text)`，所以它寫的是**一整段**：
 *
 * ```
 * diff 的問法    有幾行的內容不一樣
 * 這裡的問法     去頭去尾之後，中間【必須整段重寫】的是哪幾行
 * ```
 *
 * ⚠️ 兩者差很多：改動兩個相隔 50 行的地方，diff 說「2 行」，
 * 而單一範圍是 **52 行**。**後者才是成本。**
 *
 * ## 🔴 而 `before` 必須是【使用者文件的實際文字】
 *
 * 規劃期我拿 `generate(原樹)` 當 `before` 量過一輪，而那是錯的：
 * 使用者的排版（縮排、空行、`enum` 折行）與我們產生的不同
 * （`history/080`§三：「內容保真 100%，**而差異全是排版**」）。
 *
 * > **我量到的是「第 2 次之後的編輯」，而我把它讀成了「所有編輯」。**
 *
 * 拿錯的座標算出的範圍套到文件上，症狀是**改到不該改的行**
 * ——而**它不會拋錯**。所以這個模組的測試斷言的是
 * 「**套用結果逐字元等於 `after`**」，不是「跨距看起來合理」。
 *
 * ## 為什麼住在 `core/projection/` 而不是 `src/vscode/`
 *
 * 🟢 它是**純文字比對，不認識任何宿主** ——放進中立目錄，
 * 網頁版哪天要用也拿得到。而中立性護欄不會因為它而叫。
 */

/** 要覆蓋的行範圍（`[startLine, endLine)`，0-based）與要寫進去的內容。 */
export interface RewriteSpan {
  /** 第一個要被覆蓋的行（0-based） */
  startLine: number
  /** 最後一個要被覆蓋的行的**下一行**（半開區間） */
  endLine: number
  /**
   * 要寫進那個範圍的**行**。
   *
   * 🔴 **為什麼是陣列不是字串**：一個字串沒有辦法分辨
   * 「**零行**」與「**一個空行**」——`''.split('\n')` 給的是 `['']`。
   *
   * 第一版就是字串，而它的症狀是**刪掉一行變成插入一個空行**
   * （三支測試同時紅）。
   *
   * > **一個把「沒有」與「零」編碼成同一個值的表示法，
   * > 遲早會拿零去回答沒有。**
   *
   * ⚠️ 那條教訓 2026-08-17 才被記下來（`experience.md`，`args0` 長度那則），
   * **而它在同一天又咬了一次**——證明它不是一個特例。
   */
  lines: string[]
}

/**
 * 算出 `before` → `after` 需要覆蓋的那一段。
 *
 * @returns 兩者相同時回傳 `null` —— **不產生空編輯**。
 */
export function rewriteSpan(before: string, after: string): RewriteSpan | null {
  if (before === after) return null

  const a = before.split('\n')
  const b = after.split('\n')

  // 共同的開頭
  let head = 0
  const maxHead = Math.min(a.length, b.length)
  while (head < maxHead && a[head] === b[head]) head++

  // 共同的結尾。
  // ⚠️ **上界是「剩下的行數」而不是「總行數」** —— 否則前後綴會重疊，
  //    而重疊的症狀是算出**負長度**的範圍（相鄰重複行最容易撞到）。
  let tail = 0
  const maxTail = Math.min(a.length - head, b.length - head)
  while (tail < maxTail && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++

  return {
    startLine: head,
    endLine: a.length - tail,
    lines: b.slice(head, b.length - tail),
  }
}

/**
 * 把範圍套回去。
 *
 * ⚠️ 這是**參考實作**：生產路徑上真正動手的是宿主的編輯 API，
 * 而它必須與這裡的語義**完全一致**。
 * 🔴 所以 `rewriteSpan` 的測試是拿這個函式驗的——
 * 兩者不一致的話，測試綠而使用者的檔案壞。
 */
export function applySpan(before: string, span: RewriteSpan): string {
  const lines = before.split('\n')
  lines.splice(span.startLine, span.endLine - span.startLine, ...span.lines)
  return lines.join('\n')
}
