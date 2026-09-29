/**
 * **編輯器那份程式碼 → 課文那一段的行號**，一張逐行的映射表。
 *
 * ## 🔴 它為什麼存在（2026-09-29，使用者帶學生上課時發現的）
 *
 * 使用者：「上面 cmath 的積木好像放錯地方。」量出來是這樣：
 *
 * ```
 * cpp-beginner/06 step5   片段 4 行,badge [1,2,4] —— 2 是【空行】,第 3 行的 cout 沒有積木
 * arduino/13-溫濕度        程式 14 行,而 badge 編到 15    ← 超出行數
 * arduino/12-液晶顯示       程式 10 行,而 badge 編到 11
 * python-bridge/06        空行在 3、6、10、13,badge 落在空行 10
 * ```
 *
 * 根因是**一個單一位移**：
 *
 * ```ts
 * const s0 = r.startLine + 1 - (win.firstLine - 1)
 * ```
 *
 * `codeRangeForNode` 回的是**編輯器裡那份程式碼**的行號，而那一份是
 * 產生器重新吐出來的——它會補鷹架、會正規化、而且**會吃掉片段裡的空行**。
 * 單一位移假設兩邊逐行一對一，空行一出現那個假設就破了，
 * 於是空行之後的每一行都錯位。
 *
 * > **兩份文字之間的對應，只有在它們逐行一樣的時候才是一個減法。**
 *
 * ## 判準
 *
 * 兩邊都**照順序**走，用 `trim()` 比對（包進 `main` 那一路會加縮排）：
 * 課文的第 k 個非空行，對上編輯器裡下一個文字相同的非空行。
 *
 * ⚠️ **空行不進表**——它沒有對應的積木，所以它不該拿到號碼。
 * ⚠️ 對不上的課文行也不進表（產生器把它改寫掉了），而那**會被護欄看見**：
 * 一行有內容而沒有號碼，是一個讀數，不是一個靜默。
 */

/** 編輯器行號（1 起算）→ 課文片段行號（1 起算）。 */
export type LineMap = Record<number, number>

export interface BuiltLineMap {
  map: LineMap
  /** 課文那一段有幾行——超出的號碼一律夾住 */
  lineCount: number
  /** 課文裡有內容、而在編輯器那份裡找不到的行（診斷用，不是錯誤） */
  unmatched: number[]
}

/**
 * @param editorCode 編輯器（`codeView.getCode()`）那一份，也就是積木的行號所依據的那一份
 * @param fenceCode  課文圍籬裡那一段，也就是讀者眼睛看到的那一份
 */
export function buildLineMap(editorCode: string, fenceCode: string): BuiltLineMap {
  const ed = editorCode.split('\n')
  const fc = fenceCode.split('\n')
  const map: LineMap = {}
  const unmatched: number[] = []
  let cursor = 0
  for (let i = 0; i < fc.length; i++) {
    const want = fc[i].trim()
    if (want === '') continue // 空行不進表
    let hit = -1
    for (let j = cursor; j < ed.length; j++) {
      if (ed[j].trim() === want) { hit = j; break }
    }
    if (hit < 0) { unmatched.push(i + 1); continue }
    map[hit + 1] = i + 1
    cursor = hit + 1
  }
  return { map, lineCount: fc.length, unmatched }
}
