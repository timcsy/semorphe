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
    this.container = document.createElement('div')
    this.container.className = 'quick-access-bar'
    // 🔴 **一群一群地建**——⚠️ 分隔線跟著它前面那一群走，
    //    否則關掉中間某一群會留下兩條連在一起的分隔線。
    const groups = [
      options.inPanel('sync') ? '<button id="sync-menu-btn" title="同步">⇄ 同步</button>' : '',
      options.inPanel('target') ? '<span id="level-selector-mount"></span>' : '',
      options.inPanel('blockStyle') ? '<span id="block-style-selector-mount"></span>' : '',
      [
        options.inPanel('undo') ? '<button id="undo-btn" title="復原">↩</button>' : '',
        options.inPanel('redo') ? '<button id="redo-btn" title="重做">↪</button>' : '',
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
