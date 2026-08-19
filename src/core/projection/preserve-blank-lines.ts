/**
 * 把使用者原本的**空行**還回產生出來的程式碼上。
 *
 * ## 🔴 為什麼需要它
 *
 * 2026-08-19 使用者在 Arduino IDE 實測：往 `setup()` 拖一顆宣告積木，
 * 而 **`loop()` 裡的空行也不見了**——他根本沒碰那一段。
 *
 * ```
 * 原檔 10 行  →  產生 6 行      實測：產生器不知道空行存在
 * ```
 *
 * 「積木→程式碼」寫回去的不是改動的那一行，是**整段主體**；
 * 而產生器從語義樹重建文字時，空行沒有任何來源，於是整份檔案被抹平。
 *
 * ## 這是「排版」，不是「真實」——使用者拍板（2026-08-19）
 *
 * 三個選項擺出來之後，選的是**保留它，但不進積木**：
 *
 * ```
 * 空行是排版      → 程式碼投影記住它，重寫時還原
 * 積木那側        → 看不到、也加不出空行
 * ```
 *
 * 🔴 所以它住在**投影**這一層，不進語義樹——那正是
 * 「唯一真實，各式投影」要求的位置：**排版是投影自己的事。**
 *
 * ⚠️ 推論一件事：使用者在積木那側**加不出**空行。那不是缺陷，是這個
 * 決定的直接後果——空行不是語義，所以語義的編輯器裡沒有它。
 *
 * ## 做法：以「非空白行」對齊，把空行掛回去
 *
 * 兩邊各自抽出非空白行，做一次最長共同子序列。對得上的那些，
 * 把原檔在它**前面**的空行數搬過來；對不上的（新加的）不給空行。
 *
 * > **要還原一件產生器不知道的事，只能靠「它前後的東西還認得出來」。**
 *
 * 🟢 順帶一個大收穫：**沒有語義變動時，結果與原檔逐字相同**
 * ——於是 `rewriteSpan` 回 `null`，**整個寫入不會發生**。
 * 在此之前，每一次同步都在重寫檔案。
 *
 * ## ⚠️ 本函式不處理什麼
 *
 * - **行內**的空白（縮排寬度、對齊）——那是 `StylePreset` 的事
 * - 空行的**語義**：它不知道那個空行「屬於」上面還是下面那一段，
 *   只知道它夾在哪兩行之間。段落被整段刪掉時，空行跟著消失。
 */

/** 前導空白的寬度。⚠️ tab 算一格——這裡只需要**比大小**，不需要真實寬度。 */
function indentOf(line: string): number {
  return line.length - line.trimStart().length
}

/** 對齊時的規模上限。超過就原樣回傳——⚠️ 寧可不還原，不要讓編輯器卡住。 */
const MAX_LINES = 4000

interface Solid {
  /** 非空白行本身 */
  readonly text: string[]
  /** `before[i]` = 第 i 個非空白行**前面**有幾個空行 */
  readonly before: number[]
  /** 最後一個非空白行**後面**還有幾個空行 */
  readonly trailing: number
}

function split(source: string): Solid {
  const text: string[] = []
  const before: number[] = []
  let run = 0
  for (const line of source.split('\n')) {
    if (line.trim() === '') { run += 1; continue }
    text.push(line)
    before.push(run)
    run = 0
  }
  return { text, before, trailing: run }
}

/**
 * 最長共同子序列，回傳 `gen[i]` 對到 `prev` 的哪一個索引（對不上是 -1）。
 *
 * ⚠️ **比對用整行文字**。重複的行（一堆 `}`）靠 LCS 的順序性區分——
 * 用「內容相同就配對」的貪婪法會把第一個 `}` 配到最後一個 `}`。
 */
function align(prev: readonly string[], gen: readonly string[]): number[] {
  const n = prev.length
  const m = gen.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = prev[i] === gen[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const map = new Array<number>(m).fill(-1)
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (prev[i] === gen[j]) { map[j] = i; i++; j++ }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++
    else j++
  }
  return map
}

/**
 * @param previous 使用者手上那一份（含他的空行）
 * @param generated 從語義樹產生的那一份（沒有空行）
 */
export function preserveBlankLines(previous: string, generated: string): string {
  if (previous === '') return generated
  const p = split(previous)
  const g = split(generated)
  if (p.text.length > MAX_LINES || g.text.length > MAX_LINES) return generated
  if (p.text.length === 0 || g.text.length === 0) return generated

  const map = align(p.text, g.text)
  const out: string[] = []
  for (let j = 0; j < g.text.length; j++) {
    const src = map[j]
    // ⚠️ 對不上 = 這一行是新加的 → **不給空行**。
    //    給了的話，插入一顆積木會憑空長出一個空行。
    let blanks = src >= 0 ? p.before[src] : g.before[j]
    if (blanks > 0 && j > 0 && map[j - 1] < 0 && indentOf(g.text[j]) < indentOf(g.text[j - 1])) {
      // 🔴 **區塊結尾的空行，被新塞進來的內容吃掉。**
      //
      // 使用者逐字（2026-08-19）：「setup 那邊原本的空行**被新東西覆蓋**
      // 感覺比較自然」。Arduino 樣板那個空行是「在這裡寫你的程式」的
      // **位置**，填進去了它就該消失。
      //
      // ⚠️ 而「新行吃掉後面的空行」這條**太寬，會壞掉另一個常見情形**：
      //
      // ```
      // foo();          加了 baz() 之後，
      //                 bar() 前面那個【分隔用】的空行
      // bar();          不該被吃掉
      // ```
      //
      // 差別在**縮排**：`}` 比新行淺（＝那是區塊的結尾），
      // 而 `bar()` 與新行**同層**（＝那是兩段之間的分隔）。
      //
      // > **一個空行是「位置」還是「分隔」，看它下一行站在哪一層。**
      blanks = 0
    }
    for (let k = 0; k < blanks; k++) out.push('')
    out.push(g.text[j])
  }
  // 🔴 結尾的空行要照**原檔**——多數編輯器靠它判斷「檔案有沒有結尾換行」，
  //    而少一個換行會讓整份檔案在 git 裡顯示成一行差異。
  const tail = map[g.text.length - 1] === p.text.length - 1 ? p.trailing : g.trailing
  for (let k = 0; k < tail; k++) out.push('')
  return out.join('\n')
}
