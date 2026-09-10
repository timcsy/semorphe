/**
 * **「你用到的東西超過這一課了」——那該換到哪一課？**
 *
 * ## 🔴 它從哪裡來（2026-09-10，使用者轉述學生的畫面）
 *
 * 學生沒有換課，一路往下寫。第 1 課只開了三顆元件
 * （`print`／`literal_string`／`endl`），而他的程式在宣告變數
 * ——於是**他自己寫的每一塊積木都被打暗**（超出這一課的範圍）。
 *
 * ```
 * 畫面上   六塊積木是淡的
 * 為什麼   沒有字說
 * 怎麼辦   藏在最下面那條狀態列的「課程」那一格裡
 * ```
 *
 * ⚠️ 而**同一個問題被問過兩次**：2026-08-28 使用者自己看著畫面問過
 * 「為何積木變這麼暗？」。那一次修的是「不該暗的別暗」，
 * 這一次是「**該暗的沒說為什麼、也沒說怎麼辦**」。
 *
 * > **一個純視覺的訊號，如果它在使用者【正當地往前走】的時候觸發，
 * > 那它讀起來不是提示，是故障。**
 *
 * ## 🟢 而「該換哪一課」是算得出來的
 *
 * 每一課都宣告了自己的 `components`。所以「同一軌裡，最早一堂涵蓋得了
 * 你正在用的那些元件的課」是一個查得到的答案，不是一句猜測。
 *
 * ## ⚠️ 這裡不知道任何語言，也不碰畫面
 *
 * 進來的是一串元件身分與一串課，出去的是一個課程 id。
 * 它住在 `src/core/`，而畫面那一側決定要不要說、怎麼說。
 */

/** 一堂課在這支演算法眼裡只有兩樣東西。 */
export interface LessonScope {
  readonly id: string
  readonly components: readonly string[]
}

export interface LessonSuggestion {
  /** 建議換到哪一課 */
  readonly lessonId: string
  /** 它涵蓋了幾顆「現在超出範圍」的元件 */
  readonly covers: number
  /** 一共有幾顆超出範圍 */
  readonly total: number
}

/**
 * **哪一課涵蓋得了這些超出範圍的元件。**
 *
 * ```
 * 全部涵蓋得了      → 回最早的那一堂（不必跳過頭）
 * 只涵蓋得了一部分   → 回涵蓋最多的那一堂，而 covers < total
 * 一堂都不比現在好   → 回 null（畫面那一側只端「自由練習」）
 * ```
 *
 * 🔴 **不建議現在這一課**——那是一句廢話，而一句廢話會讓下一句真話被略過。
 *
 * ⚠️ **順序用課程 id 的字典序**：課程 id 帶編號（`01-…`），
 * 所以字典序**就是**課程順序。這與 `viewForLesson` 用的是同一條規矩
 * ——⚠️ 兩處都靠它，改了要一起改。
 *
 * @param outOfScope 現在超出範圍的元件身分
 * @param lessons    候選的課（呼叫端決定是不是限定同一軌）
 * @param currentId  現在釘住哪一課——它自己不會被建議
 */
export function suggestLessonFor(
  outOfScope: readonly string[],
  lessons: readonly LessonScope[],
  currentId: string,
): LessonSuggestion | null {
  const want = new Set(outOfScope)
  if (want.size === 0) return null

  let best: LessonSuggestion | null = null
  for (const lesson of [...lessons].sort((a, b) => a.id.localeCompare(b.id))) {
    if (lesson.id === currentId) continue
    const has = new Set(lesson.components)
    let covers = 0
    for (const c of want) if (has.has(c)) covers++
    if (covers === 0) continue
    // ⚠️ **嚴格大於**——平手時留著先找到的那一堂（＝比較早的那一堂）。
    //    平手換人的話，建議會跳到軌道的最後面，而那不是「下一步」。
    if (best === null || covers > best.covers) {
      best = { lessonId: lesson.id, covers, total: want.size }
      // 🟢 全部涵蓋得了就停——**不必再往後找一堂涵蓋得更多的**，
      //    因為沒有「更多」了，而更後面的課會把學生推過頭。
      if (covers === want.size) break
    }
  }
  return best
}
