export class SplitPane {
  private container: HTMLElement
  private leftPanel: HTMLElement
  private rightPanel: HTMLElement
  private divider: HTMLElement
  private isDragging = false
  private leftRatio = 0.5

  constructor(container: HTMLElement) {
    this.container = container
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
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    })

    document.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return
      const rect = this.container.getBoundingClientRect()
      const x = e.clientX - rect.left
      this.leftRatio = Math.max(0.15, Math.min(0.85, x / rect.width))
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
    const dividerWidth = 4
    this.leftPanel.style.width = `calc(${this.leftRatio * 100}% - ${dividerWidth / 2}px)`
    this.rightPanel.style.width = `calc(${(1 - this.leftRatio) * 100}% - ${dividerWidth / 2}px)`
  }
}
