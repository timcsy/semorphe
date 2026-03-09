/**
 * BlockToolbar — 積木面板上方的工具列
 * 包含：同步按鈕、等級選擇、積木風格、undo/redo/clear、匯出/匯入/上傳
 */
export class QuickAccessBar {
  private container: HTMLElement

  constructor(parent: HTMLElement) {
    this.container = document.createElement('div')
    this.container.className = 'quick-access-bar'
    this.container.innerHTML = `
      <button id="auto-sync-btn" class="auto-sync-on" title="自動同步：開啟">⇄ 自動</button>
      <button id="sync-blocks-btn" title="積木 → 程式碼">積木→程式碼</button>
      <button id="sync-code-btn" title="程式碼 → 積木">程式碼→積木</button>
      <span class="toolbar-separator"></span>
      <span id="level-selector-mount"></span>
      <span class="toolbar-separator"></span>
      <span id="block-style-selector-mount"></span>
      <span class="toolbar-separator"></span>
      <button id="undo-btn" title="復原">↩</button>
      <button id="redo-btn" title="重做">↪</button>
      <button id="clear-btn" title="清空">清空</button>
      <span class="toolbar-separator"></span>
      <div class="file-menu-group">
        <button id="file-menu-btn" title="檔案">檔案 ▾</button>
        <div id="file-menu" class="file-menu" style="display:none">
          <div class="file-menu-option" id="export-btn">匯出</div>
          <div class="file-menu-option" id="import-btn">匯入</div>
          <div class="file-menu-option" id="upload-blocks-btn">上傳自訂積木</div>
        </div>
      </div>
    `
    parent.appendChild(this.container)
  }

  getElement(): HTMLElement {
    return this.container
  }
}
