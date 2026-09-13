/**
 * **「這一課會用到哪些操作」的登錄表。**
 *
 * ## 🔴 為什麼是一份宣告，而不是課文裡的一段話
 *
 * 操作說明寫在課文裡會腐爛：UI 改一次，66 課裡有一部分就變成謊話，
 * **而它腐爛的時候沒有人會發現**。
 *
 * 所以：課程只宣告「我會用到 `drag-block`」，**長什麼樣由這裡說**，
 * 而那個片段是**腳本錄的**（`tools/demo/record-clips.spec.ts`）——按鈕搬家的那天
 * 錄製會紅。
 *
 * > **一張手工截的圖是死的；一支腳本錄的片段是活的——按鈕搬家時它會紅。**
 *
 * ## 兩個消費者
 *
 * ```
 * 課文頁     產生器讀它，把片段插進「這一課會用到的操作」
 * app 之後   「就地提示」——第一次遇到某個操作時說一句
 *            （見 draft/2026-09-04-操作說明要會過期就變紅 §二）
 * ```
 *
 * ⚠️ 所以它住在 `core/`，不住在 `tools/`：**建置期與執行期讀的是同一份**。
 */

export interface Interaction {
  readonly id: string
  /** 給人看的一句話——課文頁的標題與 app 提示共用。 */
  readonly label: string
  /** 影片檔（相對於站台根）。⚠️ webm 不是 GIF：見 `tools/demo/to-gif.sh` 的理由。 */
  readonly clip: string
  /** 無障礙描述——⚠️ 影片沒有字幕，這是唯一說得出「這裡發生了什麼」的地方。 */
  readonly alt: string
}

/**
 * ⚠️ **加一個互動＝加一筆這裡 ＋ 一支錄製**，兩邊都不能少
 * ——`audit-lesson-pages` 兩個方向都驗。
 */
export const INTERACTIONS: readonly Interaction[] = [
  {
    id: 'drag-block',
    label: '從工具箱拖一顆積木出來',
    clip: '/clips/clip-drag.webm',
    alt: '點開「輸入/輸出」分類，把「輸出」那顆積木拖進畫布，左邊的程式碼跟著多一行',
  },
  {
    id: 'switch-layout',
    label: '切成「對照」，一次看到兩邊',
    clip: '/clips/clip-compare.webm',
    alt: '點狀態列右邊的版面，選「對照」，畫面變成程式碼與積木兩欄',
  },
  {
    id: 'run',
    label: '按執行，看主控台',
    clip: '/clips/clip-run.webm',
    alt: '按右上角的執行，底下的主控台印出程式的輸出',
  },
]

export const interactionById = (id: string): Interaction | undefined =>
  INTERACTIONS.find((i) => i.id === id)
