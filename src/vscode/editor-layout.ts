/**
 * **版面宣告 → VSCode 自己的編輯器分組**（2026-09-01）。
 *
 * ## 🔴 它從哪來
 *
 * 使用者看到狀態列上「版面」那一格不見了，問：「**我現在要如何切換佈局？**」
 * 接著逐字：「**我要的就是這個，你怎麼現在才聽懂？**」
 *
 * 而我上一刀把版面選單整個拿掉了，理由是「一個只有一個選項的選單是假的按鈕」。
 * 那個理由對一半——它在「只畫一層的視窗」裡是對的，而我從它推論成
 * 「所以版面這件事我們不談了」。
 *
 * > **把【繪製】交出去，不等於把【談論它】也交出去。**
 * > 使用者要的是一鍵到位的四個版面，而不是「我自己畫格子」
 * > ——把後者拿掉時，順手把前者也帶走了。
 *
 * ## 🟢 而交出去之後，那四個名字第一次變成真的
 *
 * ```
 * 我們自己畫 grid 的時候        交給 VSCode 之後
 *   十字（四格，每一層一格）      十字（四格，每一層一格）
 *   🔴 只畫得出兩格               🟢 程式碼｜流程／積木 ＋ 終端機 = 四格
 *      （程式碼與主控台不在        因為程式碼是 IDE 的編輯器、
 *        我們的 webview 裡）        主控台是 IDE 的終端機
 * ```
 *
 * ## 這個模組不做什麼
 *
 * - **不認識 `vscode`**——它只把宣告翻譯成一棵樹與一張「哪一層去第幾組」的表。
 *   ⚠️ 那是刻意的：這段推導要測得到，而 `vscode` 在測試環境不存在
 *   （與 `sync/view-state.ts` 同一條理由）。
 */
import type { LayoutPresetSpec } from '../core/host/layout-presets'
import type { UnderstandingLayer } from '../core/view-host'

/**
 * `vscode.setEditorLayout` 吃的形狀。
 *
 * ⚠️ `orientation` **只出現在最外層**，巢狀的那一層由 VSCode 自己取垂直的那個
 * ——官方文件那個 2×2 的例子就是這樣寫的。
 */
export interface EditorGroupLayout {
  orientation: 0 | 1
  groups: GroupNode[]
}
export interface GroupNode {
  groups?: GroupNode[]
  size?: number
}

/** 水平：一組一組**並排**。 */
const HORIZONTAL = 0

export interface EditorLayoutPlan {
  /** 交給 `vscode.setEditorLayout` 的那個物件。 */
  readonly layout: EditorGroupLayout
  /**
   * 每一層去第幾組（1 起算，就是 `ViewColumn`）。
   *
   * ⚠️ **不含 `state`**——主控台是 IDE 的終端機，它不住在編輯器區。
   */
  readonly columnOf: ReadonlyMap<UnderstandingLayer, number>
}

/**
 * 把一張版面宣告翻成「編輯器要拆成什麼形狀，誰去哪一格」。
 *
 * 推導只有兩步，而兩步都只看 `areas`：
 *
 * ```
 * ① 一欄 → 一個外層分組            （由左到右）
 * ② 那一欄裡有幾種【不同的】層 → 那一組再拆幾列
 * ```
 *
 * 🔴 而 `state` 在這一步**先被拿掉**：它是終端機，不是編輯器分組。
 * ⚠️ 拿掉之後整欄空掉的話，那一欄不產生分組（否則會多出一格空白的編輯器）。
 *
 * > **一份宣告翻譯到另一個系統時，翻不過去的那一格不是「留白」，是「不存在」。**
 */
export function planEditorLayout(
  preset: LayoutPresetSpec,
  focusLayer: UnderstandingLayer,
): EditorLayoutPlan {
  const resolved = preset.areas.map((row) =>
    row.map((v) => (v === '*' ? focusLayer : v)))

  // 一欄一欄看：由上到下取「不同的層」，並且丟掉主控台。
  const columns: UnderstandingLayer[][] = []
  for (let c = 0; c < resolved[0].length; c++) {
    const cell: UnderstandingLayer[] = []
    for (const row of resolved) {
      const l = row[c]
      if (l === 'state') continue          // 主控台 ＝ 終端機，不佔編輯器分組
      if (cell[cell.length - 1] !== l) cell.push(l)
    }
    if (cell.length > 0) columns.push(cell)
  }

  // 走一遍樹，順便把「第幾組」記下來——**順序就是 VSCode 的分組編號**。
  const columnOf = new Map<UnderstandingLayer, number>()
  let n = 0
  const groups: GroupNode[] = columns.map((cell) => {
    if (cell.length === 1) { columnOf.set(cell[0], ++n); return {} }
    return { groups: cell.map((l) => { columnOf.set(l, ++n); return {} }) }
  })

  return { layout: { orientation: HORIZONTAL, groups }, columnOf }
}
