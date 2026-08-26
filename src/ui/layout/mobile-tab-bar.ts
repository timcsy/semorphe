import { LAYER_ORDER } from '../../core/view-host'
import type { UnderstandingLayer } from '../../core/view-host'

export type TabId = 'code' | 'flow' | 'blocks' | 'console'

interface TabDef {
  id: TabId
  icon: string
  label: string
}

/**
 * 🔴 **順序不再寫在這裡——它來自 `LAYER_ORDER`**（2026-08-26）。
 *
 * 這個檔本來有一份手寫的四元素陣列，而順序的**理由**寫在它上面的註解裡：
 * 使用者 2026-08-24 逐字「程式碼、流程、積木、主控台這個順序是我用
 * **元素、關係、空間、動力**來思考，**代表理解的不同層次**……**不是誰比較重要**」。
 *
 * > **一個寫在註解裡的理由，擋不住下一個人在陣列中間插一格。**
 *
 * 現在順序是 `LAYER_ORDER`（`core/view-host.ts`，那也是面板自己宣告的那四個值），
 * 而**這個檔只擁有「那一層在手機上長什麼樣」**——圖示與字。
 *
 * ⚠️ **那正是分界**：層次是這個系統的語義，圖示與字是這個宿主的呈現。
 * 第二個宿主（VSCode）會把同樣四層翻成別的東西，而它不必重新決定順序。
 */
const LAYER_CHROME: Record<UnderstandingLayer, TabDef> = {
  element: { id: 'code', icon: '📝', label: '程式碼' },
  relation: { id: 'flow', icon: '🔗', label: '流程' },
  space: { id: 'blocks', icon: '🧩', label: '積木' },
  state: { id: 'console', icon: '▶', label: '主控台' },
}

const TABS: TabDef[] = LAYER_ORDER.map((l) => LAYER_CHROME[l])

/** 這條分頁列今天呈現哪幾層——給組裝點拿去與**真的登記了的視圖**對照。 */
export const TAB_LAYERS: readonly UnderstandingLayer[] = LAYER_ORDER

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
