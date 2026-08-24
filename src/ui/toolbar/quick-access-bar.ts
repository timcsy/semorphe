/**
 * BlockToolbar — 積木面板上方的工具列
 * 包含：同步按鈕、等級選擇、積木風格、undo/redo/clear、匯出/匯入/上傳
 */
/**
 * 檔案選單的標記。
 *
 * 🔴 **它是一個【可以不存在】的東西** ——一個「檔案由 IDE 管」的宿主裡，
 * 面板再放一份「開檔／存檔」會有兩個「目前的檔案」。
 *
 * ⚠️ 而處置是**不建**，不是建了再 `display:none`：
 *
 * > **一個長得一樣而按下去沒反應的按鈕，比沒有那顆按鈕更糟
 * > ——因為它讓「像」變成一個謊。**
 */
const FILE_MENU_MARKUP = `
      <span class="toolbar-separator"></span>
      <div class="file-menu-group">
        <button id="file-menu-btn" title="檔案">檔案 ▾</button>
        <div id="file-menu" class="file-menu" style="display:none">
          <div class="file-menu-option" id="export-btn">匯出</div>
          <div class="file-menu-option" id="import-btn">匯入</div>
          <div class="file-menu-option" id="upload-blocks-btn">上傳自訂積木</div>
        </div>
      </div>`

export interface QuickAccessBarOptions {
  /** 要不要建檔案選單。⚠️ `false` ＝ **不建那些 DOM**。 */
  fileButtons: boolean
}

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
    this.container.innerHTML = `
      <button id="sync-menu-btn" title="同步">⇄ 同步</button>
      <span class="toolbar-separator"></span>
      <span id="level-selector-mount"></span>
      <span class="toolbar-separator"></span>
      <span id="block-style-selector-mount"></span>
      <span class="toolbar-separator"></span>
      <button id="undo-btn" title="復原">↩</button>
      <button id="redo-btn" title="重做">↪</button>
      <button id="clear-btn" title="清空">清空</button>
      ${options.fileButtons ? FILE_MENU_MARKUP : ''}
    `
    parent.appendChild(this.container)
  }

  getElement(): HTMLElement {
    return this.container
  }
}
