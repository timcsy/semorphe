import { createPanelHead } from '../layout/cell-head'
/**
 * BlockToolbar — 積木面板上方的工具列
 * 包含：同步按鈕、等級選擇、積木風格、undo/redo/clear、匯出/匯入/上傳
 */
export interface QuickAccessBarOptions {
  /**
   * 這一顆控制項要不要建。
   *
   * 🔴 **問登錄表，不是問宿主**（`core/host/controls.ts`）——
   * 一旦這裡寫成 `if (host === 'vscode')`，那份宣告就退化成一個標籤。
   */
  inPanel: (id: ControlId) => boolean
}

import type { ControlId } from '../../core/host/controls'

export class QuickAccessBar {
  private container: HTMLElement

  /**
   * 🔴 **同步從三顆變一顆**（2026-08-25）。
   *
   * 舊的兩顆是【方向】（N²）：`sync-blocks-btn` / `sync-code-btn`。
   * 新的一顆問的是【來源】（N）——清單由 `viewsWith('editable')` 導出，
   * **加第三個可編輯視圖時不必新增按鈕**。
   *
   * 而三態（同步中／已暫停／分岔了）顯示在**狀態列**：它是全域的、永遠看得見，
   * 而「暫停中必須看得見」是這一刀的驗收之一。
   * 機制見 `core/sync-coordinator.ts`。
   */
  constructor(parent: HTMLElement, options: QuickAccessBarOptions) {
    // 🔴 框架走同一支產生器（spec 170 · T012）。
    this.container = createPanelHead('quick-access-bar').el
    // 🔴 **一群一群地建**——⚠️ 分隔線跟著它前面那一群走，
    //    否則關掉中間某一群會留下兩條連在一起的分隔線。
    const groups = [
      options.inPanel('sync') ? '<button id="sync-menu-btn" title="同步">⇄ 同步</button>' : '',
      // 🔴 **editor 區看哪一個投影**——積木（空間層）／流程（關係層）。
      //    ⚠️ 它是這一欄的分頁列，不是「面板的裝飾」：兩個都是**程式本身**的投影。
      // 🪦 **`#view-tabs` 退場**（2026-09-01，spec 169）：切換視圖的分頁列
      //    改由**槽**提供（`app-shell.ts` 的 `buildSlotTabs`）——每一個槽一條，
      //    而且**選項完全相同**。
      //
      // 🔴 它住在這裡的時候，它是「積木那一欄的工具列」的一部分
      //    ——於是那一欄被藏起來時，切回去的按鈕跟著不見（2026-09-01 撞過）。
      //
      // > **一條工具列如果住在它所操作的東西裡面，
      // > 那個東西被藏起來的時候，你就沒有辦法把它叫回來。**
      options.inPanel('target') ? '<span id="level-selector-mount"></span>' : '',
      options.inPanel('target') ? '<span id="track-selector-mount"></span>' : '',
      options.inPanel('target') ? '<span id="lesson-selector-mount"></span>' : '',
      options.inPanel('target') ? '<span id="template-selector-mount"></span>' : '',
      options.inPanel('target') ? '<span id="scaffold-selector-mount"></span>' : '',
      options.inPanel('blockStyle') ? '<span id="block-style-selector-mount"></span>' : '',
      [
        // 🔴 **`#undo-slot` 是一個永遠不動的插槽，`#undo-group` 是會搬家的那一組。**
        //
        // 行動版把 ↩↪ 搬到全域標頭（`app-shell.ts` 的 `rememberUndoHome` 那一段
        // 記著為什麼），而搬回來時**不能靠記兄弟節點**：
        // `undo` 的下一個是 `redo`，而還原第一顆的時候第二顆還在標頭裡
        // ——`insertBefore` 對一個不是自己小孩的參考節點會丟 `NotFoundError`。
        //
        // > **一組互相參照的錨點，還原時第一個總會指向一個還沒回家的鄰居。**
        //
        // 留一個空插槽就沒有這個問題：搬回去只是 `slot.appendChild(group)`，
        // 而插槽自己從來沒離開過。
        options.inPanel('undo') || options.inPanel('redo')
          ? '<span id="undo-slot"><span id="undo-group">' +
            (options.inPanel('undo') ? '<button id="undo-btn" title="復原">↩</button>' : '') +
            (options.inPanel('redo') ? '<button id="redo-btn" title="重做">↪</button>' : '') +
            '</span></span>'
          : '',
        options.inPanel('clear') ? '<button id="clear-btn" title="清空">清空</button>' : '',
      ].join(''),
    ].filter((g) => g !== '')
    this.container.innerHTML = `
      ${groups.join('\n      <span class="toolbar-separator"></span>\n      ')}
    `
    parent.appendChild(this.container)
  }

  getElement(): HTMLElement {
    return this.container
  }
}
