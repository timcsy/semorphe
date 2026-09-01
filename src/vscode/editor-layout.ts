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
  /**
   * 每一層照**分組的順序**排出來——第 0 個去第一組、第 1 個去第二組……
   *
   * 🔴 **它是「第幾個」，不是「第幾號」**（2026-09-01 實測之後改的）。
   *
   * 第一版回傳的是一張「層 → `ViewColumn` 號碼」的表，號碼由這裡自己數。
   * 而使用者按了十字之後的實測：程式碼在左上 ✅、流程在右上 ✅、積木在右下 ✅，
   * **主控台跑去跟流程擠同一組**，左下留了一格空的。
   *
   * ⚠️ 因為 `ViewColumn` 的號碼**不是我們數得出來的**——它是 VSCode 自己的
   * 分組編號，而巢狀版面重排之後，那串號碼與「由左到右、由上到下」不一致。
   *
   * > **一個「第幾個」的索引，只在【被數的東西與被指的東西一一對應時】才成立。**
   *
   * 🔴 同一句話**同一天出現第二次**——第一次是 `ui/layout/grid-dividers.ts`
   * 的 `boundaryAt`（把手的序號 vs 軌道的序號）。處置也一樣：**問，不要數**。
   * 排完之後問 `vscode.window.tabGroups.all`「你現在有哪些組」，再照順序配。
   */
  readonly order: readonly UnderstandingLayer[]

  /** 🪦 由 `order` 導出，只給測試與說明用——**執行時不要拿它當 `ViewColumn`**。 */
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
 * ⚠️ 整欄空掉的話那一欄不產生分組（否則會多出一格空白的編輯器）——
 *    今天四層都在，所以到不了；而它是**便宜的正確**，留著。
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
      // 相鄰而相同 ＝ **跨格**，不是兩格（`normalizeShape` 那條規矩的同一句）
      if (cell[cell.length - 1] !== l) cell.push(l)
    }
    if (cell.length > 0) columns.push(cell)
  }

  // 走一遍樹，把「第幾個分組是誰」按順序記下來。
  // ⚠️ **只記順序，不記號碼**——號碼要問 VSCode（見 `order` 的說明）。
  const order: UnderstandingLayer[] = []
  const groups: GroupNode[] = columns.map((cell) => {
    if (cell.length === 1) { order.push(cell[0]); return {} }
    return { groups: cell.map((l) => { order.push(l); return {} }) }
  })

  const columnOf = new Map(order.map((l, i) => [l, i + 1] as const))
  return { layout: { orientation: HORIZONTAL, groups }, order, columnOf }
}
