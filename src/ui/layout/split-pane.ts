/**
 * 兩格 ＋ 一條可拖的分隔線。
 *
 * ## 🔴 為什麼會有 `orientation`
 *
 * 網頁版是**左右**分：積木 ‖ 程式碼＋主控台。
 * 而在一個「文字編輯交給宿主」的宿主裡**沒有程式碼那一格**
 * ——左右分就變成「積木佔一半、主控台佔另一半整條」，
 * 而那不是「像網頁版」，是把空出來的位置留給了錯的東西。
 *
 * > **拿掉一格之後，剩下兩格的關係要重新問一次
 * > ——版面不是「少一格的版面」，是另一個版面。**
 *
 * ⚠️ 方向**不是新的能力旗標**：它由 `features.codeEditorPane` 推導。
 * 多開一個旗標會讓「沒有程式碼格」與「直向排」可以各自設定，
 * 而它們其實是同一件事的兩種說法。
 */
export type SplitOrientation = 'horizontal' | 'vertical'

export class SplitPane {
  private container: HTMLElement
  private leftPanel: HTMLElement
  private rightPanel: HTMLElement
  private divider: HTMLElement
  private isDragging = false
  private leftRatio = 0.5
  private readonly orientation: SplitOrientation

  constructor(container: HTMLElement, orientation: SplitOrientation = 'horizontal') {
    this.container = container
    this.orientation = orientation
    if (orientation === 'vertical') {
      // ⚠️ 直向時第一格佔多數：積木是主角，主控台是輔助。
      this.leftRatio = 0.68
      container.classList.add('split-vertical')
    }
    this.leftPanel = document.createElement('div')
    this.leftPanel.className = 'split-left'
    this.rightPanel = document.createElement('div')
    this.rightPanel.className = 'split-right'
    this.divider = document.createElement('div')
    this.divider.className = 'split-divider'

    this.container.appendChild(this.leftPanel)
    this.container.appendChild(this.divider)
    this.container.appendChild(this.rightPanel)

    this.setupDrag()
    this.applyRatio()
  }

  getLeftPanel(): HTMLElement { return this.leftPanel }
  getRightPanel(): HTMLElement { return this.rightPanel }

  private setupDrag(): void {
    this.divider.addEventListener('mousedown', (e) => {
      e.preventDefault()
      this.isDragging = true
      document.body.style.cursor = this.orientation === 'vertical' ? 'row-resize' : 'col-resize'
      document.body.style.userSelect = 'none'
    })

    document.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return
      const rect = this.container.getBoundingClientRect()
      const offset = this.orientation === 'vertical' ? e.clientY - rect.top : e.clientX - rect.left
      const extent = this.orientation === 'vertical' ? rect.height : rect.width
      this.leftRatio = Math.max(0.15, Math.min(0.85, offset / extent))
      this.applyRatio()
    })

    document.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        // Trigger resize event for Blockly/Monaco to recalculate
        window.dispatchEvent(new Event('resize'))
      }
    })
  }

  private applyRatio(): void {
    const dividerSize = 4
    const first = `calc(${this.leftRatio * 100}% - ${dividerSize / 2}px)`
    const second = `calc(${(1 - this.leftRatio) * 100}% - ${dividerSize / 2}px)`
    if (this.orientation === 'vertical') {
      this.leftPanel.style.height = first
      this.rightPanel.style.height = second
    } else {
      this.leftPanel.style.width = first
      this.rightPanel.style.width = second
    }
  }
}
