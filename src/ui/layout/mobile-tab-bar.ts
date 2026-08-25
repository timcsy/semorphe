export type TabId = 'code' | 'flow' | 'blocks' | 'console'

interface TabDef {
  id: TabId
  icon: string
  label: string
}

/**
 * 🔴 **順序是【理解的四個層次】**，不是「誰比較重要」。
 *
 * 使用者 2026-08-24 逐字：「程式碼、流程、積木、主控台這個順序是我用
 * **元素、關係、空間、動力**來思考，**代表理解的不同層次**（靈感從
 * Transformer 裡面運算的順序而來），**不是誰比較重要**」
 * ——同日收斂為「元素、關係、空間、**狀態**」。
 *
 * ```
 * 元素  程式碼   有哪些東西        token／嵌入
 * 關係  流程     誰跟誰有關        attention
 * 空間  積木     怎麼被擺在一起    表示空間
 * 狀態  主控台   現在裡面裝了什麼   殘差流
 * ```
 *
 * ⚠️ 而 2026-08-25 之前這裡只有三個——**流程從來沒有進來過**，
 * 它住在下方面板（狀態層）裡。見 `draft/版面與檔案` §六之五。
 */
const TABS: TabDef[] = [
  { id: 'code', icon: '📝', label: '程式碼' },
  { id: 'flow', icon: '🔗', label: '流程' },
  { id: 'blocks', icon: '🧩', label: '積木' },
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
