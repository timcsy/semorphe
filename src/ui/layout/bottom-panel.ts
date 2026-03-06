export interface TabDefinition {
  id: string
  label: string
  panel: HTMLElement
}

export class BottomPanel {
  private container: HTMLElement
  private tabBar: HTMLElement
  private contentArea: HTMLElement
  private divider: HTMLElement
  private tabs: TabDefinition[] = []
  private activeTabId: string | null = null
  private isDragging = false
  private collapsed = false
  private heightRatio = 0.35

  constructor(container: HTMLElement) {
    this.container = container
    this.container.classList.add('bottom-panel')

    this.divider = document.createElement('div')
    this.divider.className = 'bottom-panel-divider'
    this.container.appendChild(this.divider)

    this.tabBar = document.createElement('div')
    this.tabBar.className = 'bottom-panel-tabs'
    this.container.appendChild(this.tabBar)

    this.contentArea = document.createElement('div')
    this.contentArea.className = 'bottom-panel-content'
    this.container.appendChild(this.contentArea)

    this.setupDrag()
  }

  addTab(tab: TabDefinition): void {
    this.tabs.push(tab)

    const tabBtn = document.createElement('button')
    tabBtn.className = 'bottom-tab-btn'
    tabBtn.dataset.tabId = tab.id
    tabBtn.textContent = tab.label
    tabBtn.addEventListener('click', () => this.activateTab(tab.id))
    this.tabBar.appendChild(tabBtn)

    tab.panel.style.display = 'none'
    this.contentArea.appendChild(tab.panel)

    if (!this.activeTabId) {
      this.activateTab(tab.id)
    }
  }

  activateTab(id: string): void {
    this.activeTabId = id
    if (this.collapsed) {
      this.collapsed = false
      this.applyHeight()
    }

    for (const tab of this.tabs) {
      tab.panel.style.display = tab.id === id ? '' : 'none'
    }

    const buttons = this.tabBar.querySelectorAll('.bottom-tab-btn')
    buttons.forEach(btn => {
      const el = btn as HTMLElement
      el.classList.toggle('active', el.dataset.tabId === id)
    })
  }

  getActiveTabId(): string | null {
    return this.activeTabId
  }

  collapse(): void {
    this.collapsed = true
    this.applyHeight()
  }

  expand(): void {
    this.collapsed = false
    this.applyHeight()
  }

  isCollapsed(): boolean {
    return this.collapsed
  }

  getElement(): HTMLElement {
    return this.container
  }

  private setupDrag(): void {
    this.divider.addEventListener('mousedown', (e) => {
      e.preventDefault()
      this.isDragging = true
      document.body.style.cursor = 'row-resize'
      document.body.style.userSelect = 'none'
    })

    document.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return
      const parent = this.container.parentElement
      if (!parent) return
      const rect = parent.getBoundingClientRect()
      const y = e.clientY - rect.top
      this.heightRatio = Math.max(0.1, Math.min(0.7, 1 - y / rect.height))
      this.collapsed = false
      this.applyHeight()
    })

    document.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        window.dispatchEvent(new Event('resize'))
      }
    })
  }

  private applyHeight(): void {
    if (this.collapsed) {
      this.contentArea.style.display = 'none'
      this.container.style.flex = '0 0 auto'
    } else {
      this.contentArea.style.display = ''
      this.container.style.flex = `0 0 ${this.heightRatio * 100}%`
    }
  }
}
