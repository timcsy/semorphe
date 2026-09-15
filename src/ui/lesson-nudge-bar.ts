/**
 * **「〈記住資料〉教的就是你正在用的東西」**——一條指路的細線。
 *
 * ## 🔴 它從哪裡來（2026-09-10）
 *
 * 學生沒有換課，一路往下寫。第 1 課只開了三顆元件，而他在宣告變數
 * ——於是**他自己寫的每一塊積木都被打暗**，而畫面上沒有一個字說為什麼。
 *
 * ```
 * 發生了什麼   六塊積木是淡的      → 看得到
 * 為什麼       釘著第 1 課          → 沒說
 * 怎麼辦       換課，或不選課程     → 藏在最下面那條狀態列裡
 * ```
 *
 * > **一個純視覺的訊號，如果它在使用者【正當地往前走】的時候觸發，
 * > 那它讀起來不是提示，是故障。**
 *
 * ## ⚠️ 這一條說的是「換課」，不是「你錯了」
 *
 * 學生沒有做錯任何事——他只是走得比課快。所以文案是**指路**
 * （「這一課教的就是它們」），不是**判決**（「你不該用這些」）。
 *
 * 🔴 而**該換哪一課是算出來的**（`core/lesson/lesson-suggest.ts`），不是寫死的：
 * 每一課都宣告了自己的 `components`。
 *
 * ## ⚠️ 不得變成一條趕不走的橫幅
 *
 * 按「不用」之後**同一個建議不再出現**。而學生又往前走到另一課的範圍時
 * （建議變了）會再問一次——那是新的資訊，不是同一句話講第二遍。
 */
import * as Blockly from 'blockly'

const msg = (key: string, fallback: string): string =>
  (Blockly.Msg as Record<string, string>)[key] || fallback

export interface LessonNudge {
  /**
   * 這一條在說哪一件事——**兩件事共用一條線，而文案完全不同**。
   *
   * ```
   * 'scope'  他走得比課快：有積木被打暗       （原本唯一的那一種）
   * 'start'  他【還沒選課】而畫布是空的        （2026-09-15）
   * ```
   *
   * 🔴 `'start'` 從哪來：整班回饋裡兩個學生說「找不到方塊」「最難的是找積木，
   * 眼睛快花了」，而他們**沒有從課程點進來**——於是拿到的是完整工具箱
   * （實測 12 個分類、196 顆）。
   *
   * > **問題不是那 196 顆太多——自由練習本來就該有全部。
   * > 問題是他不知道有一條帶路的，而那條路的入口在最下面那條狀態列裡。**
   */
  readonly kind?: 'scope' | 'start'
  /** 現在釘著哪一課的**名字**（給人看的）——`'start'` 時是空字串 */
  readonly currentTitle: string
  /** 有幾種積木被打暗 */
  readonly dimmedCount: number
  /** 建議換到哪一課——`null` ＝ 沒有一堂沾得上邊 */
  readonly suggestion: { readonly lessonId: string; readonly title: string } | null
  /** 按下「換過去」 */
  readonly onSwitch: (lessonId: string) => void
  /** 按下「自由練習」 */
  readonly onFreePractice: () => void
}

export class LessonNudgeBar {
  private el: HTMLElement
  /**
   * 已經被按掉的建議。
   *
   * 🔴 **鍵是「建議換到哪一課」，不是「按過了沒」**——學生再往前走到
   * 另一課的範圍時，那是**新的資訊**，該再問一次。
   */
  private dismissed = new Set<string>()

  constructor(host: HTMLElement, anchor: Node | null) {
    this.el = document.createElement('div')
    this.el.className = 'lesson-nudge-bar'
    this.el.hidden = true
    host.insertBefore(this.el, anchor)
  }

  /** 沒有東西要說的時候**整條收起來**——一條空的列只是把版面吃掉。 */
  hide(): void {
    this.el.hidden = true
    this.el.replaceChildren()
  }

  show(n: LessonNudge): void {
    const key = `${n.kind ?? 'scope'}|${n.suggestion?.lessonId ?? '(沒有建議)'}`
    if (this.dismissed.has(key)) { this.hide(); return }

    this.el.replaceChildren()
    const text = document.createElement('span')
    text.className = 'lesson-nudge-text'
    // 🔴 **主詞是那一課，不是「你用錯了」**——見檔頭。
    text.textContent = n.kind === 'start'
      // ⚠️ 不說「積木太多」——那會讓他以為自己選錯了。說的是「有一條帶路的」。
      ? msg('LESSON_NUDGE_START', '第一次來？〈{next}〉會一步一步帶你，積木盤也會只留這一課要用的。')
        .replace('{next}', n.suggestion?.title ?? '第 1 課')
      : n.suggestion
        ? msg('LESSON_NUDGE_SWITCH', '〈{next}〉教的就是你正在用的東西（現在有 {n} 種積木是淡的）')
          .replace('{next}', n.suggestion.title).replace('{n}', String(n.dimmedCount))
        : msg('LESSON_NUDGE_BEYOND', '有 {n} 種積木不在〈{cur}〉裡——所以它們是淡的')
          .replace('{n}', String(n.dimmedCount)).replace('{cur}', n.currentTitle)
    this.el.appendChild(text)

    const button = (label: string, run: () => void, primary = false): void => {
      const b = document.createElement('button')
      b.className = primary ? 'lesson-nudge-btn primary' : 'lesson-nudge-btn'
      b.textContent = label
      b.addEventListener('click', run)
      this.el.appendChild(b)
    }
    if (n.suggestion) {
      const s = n.suggestion
      button(
        n.kind === 'start' ? msg('LESSON_NUDGE_BEGIN', '從這一課開始') : msg('LESSON_NUDGE_GO', '換過去'),
        () => { this.hide(); n.onSwitch(s.lessonId) }, true)
    }
    // ⚠️ `'start'` 不給「自由練習」——他**已經在**自由練習了
    if (n.kind !== 'start') {
      button(msg('LESSON_NUDGE_FREE', '自由練習'), () => { this.hide(); n.onFreePractice() })
    }
    // ⚠️ 「不用」要在最後，而且**不是主要按鈕**——它是一條建議，不是一道門。
    button(msg('LESSON_NUDGE_DISMISS', '不用'), () => { this.dismissed.add(key); this.hide() })

    this.el.hidden = false
  }
}
