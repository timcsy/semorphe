/**
 * **一格的頭，只有一支產生器**（spec 170 · US2）。
 *
 * ## 🔴 它從哪來
 *
 * 2026-09-01 使用者：「你可以**統一一下這些面板的框架**嗎？」
 * 那天先把**樣式**收成一份（四份定義長出了三個底色與三個間距），
 * 而**產生器仍然有五個**：
 *
 * ```
 * panels/monaco-panel.ts:611      bar.className = 'monaco-clipboard-bar'
 * panels/flow-panel.ts:977        bar.className = 'flow-toolbar'
 * layout/bottom-panel.ts:37       this.tabBar.className = 'bottom-panel-tabs'
 * toolbar/quick-access-bar.ts     自己建一個
 * app-shell.ts 的 .panel-head     沒有工具列時的那一條
 * ```
 *
 * > **長得一樣不等於是同一種東西**——五份各自建的，遲早會再長出第六個底色。
 *
 * ## ⚠️ 它統一的是【框架】，不是每一顆按鈕
 *
 * 那四條頭裡有真的不一樣的東西（monaco 要 editor、流程要 offsets、
 * 主控台那條是分頁不是動作）。把它們也塞進宣告，宣告會變成一個難懂的 DSL。
 *
 * > **宣告該吃掉的是【重複的那些】，不是【真的不一樣的那個】。**
 *
 * 所以這裡產出的是：**那個 div、它的 class、以及「名字排最左」這件事**。
 * 內容由面板自己接上去。
 *
 * ## 🔴 為什麼舊的 class 留著
 *
 * `class="panel-head flow-toolbar"`——前者是**框架**（樣式住在它身上），
 * 後者是**掛鉤**（e2e 的選擇器、`mountSlotPickers` 的 `bar`、
 * 行動版 `adoptActionBarSections` 的搬移，都用它認人）。
 *
 * > **把兩個責任壓在同一個 class 上，改樣式就會動到誰認得誰。**
 *
 * ## 🪦 為什麼叫 `cell-head` 而不是 `panel-head`
 *
 * 第一版叫 `panel-head.ts`，而第三十九條護欄（**視圖之間不得互相 import**）
 * 當場紅了——它用**檔名**認視圖（`*panel*`），而 `flow-panel` import 它
 * 就長得像「一個面板 import 另一個面板」。
 *
 * ⚠️ 那是**誤報**（這裡不是視圖，是版面的共用件），而改名是對的處置：
 * 它做的東西是**一格的頭**，而 `style.css` 那一段本來就叫它「一格的頭」。
 *
 * > **一個會被工具誤認的名字，多半也會被人誤認。**
 */

/** 這一格的頭。⚠️ 名字那一顆由 `app-shell` 掛上去，永遠排最左。 */
export interface PanelHead {
  /** 那個 `<div>`。 */
  readonly el: HTMLElement
  /** 名字之後的那一段——面板自己的東西接這裡。 */
  readonly actions: HTMLElement
}

/**
 * 建一條頭。
 *
 * @param hook 舊的 class（`flow-toolbar` 等）——**掛鉤，不是樣式**。見檔頭。
 */
export function createPanelHead(hook?: string): PanelHead {
  const el = document.createElement('div')
  el.className = hook ? `panel-head ${hook}` : 'panel-head'
  // 🔴 **名字的位子先留出來**——不留的話它會被面板自己的東西擠到後面，
  //    而「名字在最左」是四格一致的那一項（spec 170 的 SC-003）。
  const actions = document.createElement('div')
  actions.className = 'panel-head-actions'
  el.appendChild(actions)
  return { el, actions }
}
