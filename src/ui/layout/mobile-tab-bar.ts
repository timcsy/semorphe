export type TabId = 'blocks' | 'code' | 'console'

interface TabDef {
  id: TabId
  icon: string
  label: string
}

const TABS: TabDef[] = [
  { id: 'blocks', icon: '🧩', label: '積木' },
  { id: 'code', icon: '📝', label: '程式碼' },
  { id: 'console', icon: '▶', label: '主控台' },
]

export class MobileTabBar {
  private element: HTMLElement
  private activeTab: TabId = 'blocks'
  private callbacks: Array<(tab: TabId) => void> = []
  private badges: Map<TabId, HTMLElement> = new Map()

  constructor(parent: HTMLElement) {
    this.element = document.createElement('div')
    this.element.className = 'mobile-tab-bar'
    this.element.style.height = '48px'

    for (const tab of TABS) {
      const item = document.createElement('button')
      item.className = 'mobile-tab-item'
      if (tab.id === this.activeTab) item.classList.add('active')
      item.setAttribute('data-tab', tab.id)

      const icon = document.createElement('span')
      icon.className = 'mobile-tab-icon'
      icon.textContent = tab.icon
      item.appendChild(icon)

      const label = document.createElement('span')
      label.className = 'mobile-tab-label'
      label.textContent = tab.label
      item.appendChild(label)

      const badge = document.createElement('span')
      badge.className = 'mobile-tab-badge'
      badge.style.display = 'none'
      item.appendChild(badge)
      this.badges.set(tab.id, badge)

      item.addEventListener('click', () => this.handleClick(tab.id))
      this.element.appendChild(item)
    }

    parent.appendChild(this.element)
  }

  getElement(): HTMLElement {
    return this.element
  }

  getActiveTab(): TabId {
    return this.activeTab
  }

  setActiveTab(tab: TabId): void {
    if (tab === this.activeTab) return
    this.activeTab = tab
    this.updateVisual()
    this.clearBadge(tab)
  }

  onTabChange(callback: (tab: TabId) => void): void {
    this.callbacks.push(callback)
  }

  setBadge(tab: TabId, show: boolean): void {
    const badge = this.badges.get(tab)
    if (badge) badge.style.display = show ? '' : 'none'
  }

  private handleClick(tab: TabId): void {
    if (tab === this.activeTab) return
    this.activeTab = tab
    this.updateVisual()
    this.clearBadge(tab)
    for (const cb of this.callbacks) {
      cb(tab)
    }
  }

  private updateVisual(): void {
    const items = this.element.querySelectorAll('.mobile-tab-item')
    items.forEach(item => {
      const el = item as HTMLElement
      el.classList.toggle('active', el.getAttribute('data-tab') === this.activeTab)
    })
  }

  private clearBadge(tab: TabId): void {
    this.setBadge(tab, false)
  }
}
