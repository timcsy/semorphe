/**
 * MobileMenu — 漢堡下拉式覆蓋選單
 * 行動裝置上收納次要控制項（選擇器、設定摘要）
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
   * Move a selector element into the mobile menu.
   * Returns a wrapper div for the item.
   */
  addSelectorMount(label: string, selectorEl: HTMLElement): HTMLElement {
    const item = document.createElement('div')
    item.className = 'mobile-menu-item'
    const labelEl = document.createElement('label')
    labelEl.textContent = label
    item.appendChild(labelEl)
    item.appendChild(selectorEl)
    this.overlay.appendChild(item)
    return item
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
