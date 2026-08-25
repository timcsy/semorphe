/**
 * MobileMenu —— 行動版的**設定表**。
 *
 * ## 🔴 它不再自己裝控制項
 *
 * 2026-08-25 之前它的內容是「從工具列搬過來的四顆 `<select>`」，
 * 而那讓行動版變成**第三個機制**：桌機一種、IDE 一種、手機一種。
 *
 * > **行動版不是「桌機版縮小」，是同一份宣告的第三個渲染器。**
 *
 * 現在它提供一格容器，內容由 `layout/status-bar-controls.ts` 的
 * `renderSheetControls` 依 `ControlState` 畫——**與狀態列讀同一份**。
 */
export class MobileMenu {
  private overlay: HTMLElement
  private isOpen = false
  private closeHandler: (e: MouseEvent) => void

  constructor(toolbarEl: HTMLElement) {
    this.overlay = document.createElement('div')
    this.overlay.className = 'mobile-menu-overlay'
    this.overlay.style.display = 'none'
    toolbarEl.appendChild(this.overlay)

    this.closeHandler = (e: MouseEvent) => {
      const hamburger = document.getElementById('hamburger-btn')
      if (
        this.isOpen &&
        !this.overlay.contains(e.target as Node) &&
        (!hamburger || !hamburger.contains(e.target as Node))
      ) {
        this.close()
      }
    }
    document.addEventListener('click', this.closeHandler)
  }

  getElement(): HTMLElement {
    return this.overlay
  }

  toggle(): void {
    if (this.isOpen) {
      this.close()
    } else {
      this.open()
    }
  }

  open(): void {
    this.isOpen = true
    this.overlay.style.display = ''
  }

  close(): void {
    this.isOpen = false
    this.overlay.style.display = 'none'
  }

  isMenuOpen(): boolean {
    return this.isOpen
  }

  /**
   * 設定表的容器——**內容不歸這個類別管**。
   *
   * ⚠️ 它建在摘要**之前**，這樣摘要永遠在最底下。
   */
  getControlsContainer(): HTMLElement {
    let box = this.overlay.querySelector('.mobile-menu-controls') as HTMLElement | null
    if (!box) {
      box = document.createElement('div')
      box.className = 'mobile-menu-controls'
      this.overlay.prepend(box)
    }
    return box
  }

  /**
   * Set the settings summary text at the bottom of the menu.
   */
  setSummary(text: string): void {
    let summary = this.overlay.querySelector('.mobile-menu-summary') as HTMLElement
    if (!summary) {
      summary = document.createElement('div')
      summary.className = 'mobile-menu-summary'
      this.overlay.appendChild(summary)
    }
    summary.textContent = text
  }

  destroy(): void {
    document.removeEventListener('click', this.closeHandler)
    this.overlay.remove()
  }
}
