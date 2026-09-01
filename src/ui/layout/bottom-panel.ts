import { createPanelHead } from './cell-head'

export interface TabAction {
  icon: string
  title: string
  onClick: () => void
}

export interface TabDefinition {
  id: string
  label: string
  panel: HTMLElement
  actions?: TabAction[]
}

export class BottomPanel {
  private container: HTMLElement
  private tabBar: HTMLElement
  private tabButtonsArea: HTMLElement
  private tabActionsArea: HTMLElement
  private contentArea: HTMLElement
  private divider: HTMLElement
  private tabs: TabDefinition[] = []
  private activeTabId: string | null = null
  private isDragging = false
  private collapsed = true
  private collapsible = true
  private heightRatio = 0.35

  constructor(container: HTMLElement) {
    this.container = container
    this.container.classList.add('bottom-panel')

    this.divider = document.createElement('div')
    this.divider.className = 'bottom-panel-divider'
    this.container.appendChild(this.divider)

    // 🔴 框架走同一支產生器（spec 170 · T011）。
    //    ⚠️ 這一條裝的是**分頁**（內容導覽）不是動作，而框架與其他三格相同
    //       ——那正是「面板統一」要的。
    this.tabBar = createPanelHead('bottom-panel-tabs').el
    this.container.appendChild(this.tabBar)

    this.tabButtonsArea = document.createElement('div')
    this.tabButtonsArea.className = 'bottom-panel-tab-buttons'
    this.tabBar.appendChild(this.tabButtonsArea)

    this.tabActionsArea = document.createElement('div')
    this.tabActionsArea.className = 'bottom-panel-tab-actions'
    this.tabBar.appendChild(this.tabActionsArea)

    this.contentArea = document.createElement('div')
    this.contentArea.className = 'bottom-panel-content'
    this.container.appendChild(this.contentArea)

    this.setupDrag()
    this.applyHeight()
  }

  addTab(tab: TabDefinition): void {
    this.tabs.push(tab)

    const tabBtn = document.createElement('button')
    tabBtn.className = 'bottom-tab-btn'
    tabBtn.dataset.tabId = tab.id
    tabBtn.textContent = tab.label
    tabBtn.addEventListener('click', () => this.activateTab(tab.id))
    this.tabButtonsArea.appendChild(tabBtn)

    tab.panel.style.display = 'none'
    this.contentArea.appendChild(tab.panel)

    if (!this.activeTabId) {
      this.activateTab(tab.id)
    }
  }

  /**
   * 這條分頁列還能不能「再按一下收起來」。
   *
   * 🔴 **行動版是 false**（2026-08-31）：收合的意思是「把下方面板讓給程式碼」，
   * 而行動版根本沒有「上面那一半」——主控台是一個**整頁的分頁**，收起來
   * 就是一整片空白。⚠️ 而這一刀把分頁列搬進畫面最上面那條工具列之後更糟：
   * 按下去像是「工具列把主控台吃掉了」，而畫面上沒有任何東西提示它收起來了。
   *
   * > **一個手勢的意思來自它旁邊的東西。把控制項搬到別的地方，
   * > 它原本的意思不會跟著搬過去。**
   *
   * ⚠️ 關掉時如果正收著就順手展開——否則那一頁會停在空白上，
   *    而使用者已經沒有那個「再按一下」可以救它了。
   */
  setCollapsible(v: boolean): void {
    this.collapsible = v
    if (!v && this.collapsed && this.activeTabId) this.showTab(this.activeTabId)
  }

  activateTab(id: string): void {
    // Toggle collapse when clicking the already-active tab
    if (this.collapsible && this.activeTabId === id && !this.collapsed) {
      this.collapsed = true
      this.applyHeight()
      // Remove active highlight and actions when collapsed
      this.tabButtonsArea.querySelectorAll('.bottom-tab-btn').forEach(btn => {
        (btn as HTMLElement).classList.remove('active')
      })
      this.tabActionsArea.innerHTML = ''
      window.dispatchEvent(new Event('resize'))
      return
    }

    this.activeTabId = id
    this.collapsed = false
    this.applyHeight()

    for (const tab of this.tabs) {
      tab.panel.style.display = tab.id === id ? '' : 'none'
    }

    const buttons = this.tabButtonsArea.querySelectorAll('.bottom-tab-btn')
    buttons.forEach(btn => {
      const el = btn as HTMLElement
      el.classList.toggle('active', el.dataset.tabId === id)
    })
    this.updateActions(id)
    window.dispatchEvent(new Event('resize'))
  }

  /**
   * 切到某個分頁並展開（不 toggle）。
   *
   * 🔴 **這個宿主沒有那一格時，什麼都不做**（2026-08-25）。
   *
   * ## 它修的是什麼
   *
   * 「主控台 → 終端機」那一刀讓 IDE 不再建主控台分頁，⚠️ **而
   * `execution-controller` 有四處還在呼叫 `showTab('console')`**。
   * 舊的實作照樣 `collapsed = false`、照樣把每一個分頁的內容藏起來
   * ——症狀是**面板展開了半個高度，而裡面是空的**（使用者截圖抓到）。
   *
   * > **移走一格 UI 而沒有移走它的呼叫端，
   * > 那些呼叫不會報錯——它們會把版面弄成一個沒有人要的形狀。**
   *
   * ⚠️ 而這裡回傳而不是丟錯：「這個宿主沒有那一格」是**宣告過的狀態**
   *（`controlSurfaces.output`），不是缺陷。
   */
  showTab(id: string): void {
    if (!this.tabs.some((t) => t.id === id)) return
    this.activeTabId = id
    this.collapsed = false
    this.applyHeight()

    for (const tab of this.tabs) {
      tab.panel.style.display = tab.id === id ? '' : 'none'
    }

    const buttons = this.tabButtonsArea.querySelectorAll('.bottom-tab-btn')
    buttons.forEach(btn => {
      const el = btn as HTMLElement
      el.classList.toggle('active', el.dataset.tabId === id)
    })
    this.updateActions(id)
    window.dispatchEvent(new Event('resize'))
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

  private updateActions(tabId: string): void {
    this.tabActionsArea.innerHTML = ''
    const tab = this.tabs.find(t => t.id === tabId)
    if (!tab?.actions) return
    for (const action of tab.actions) {
      const btn = document.createElement('button')
      btn.className = 'bottom-panel-action-btn'
      btn.title = action.title
      btn.textContent = action.icon
      btn.addEventListener('click', action.onClick)
      this.tabActionsArea.appendChild(btn)
    }
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

  /**
   * 這一格是不是住在一張 **grid** 裡（2026-08-31，spec 168）。
   *
   * 🔴 是的話**高度不歸這裡管**——它是 `grid-template-rows` 的一條軌道，
   * 而那份狀態只住在容器上。這裡再寫一次 `flex` 就是**兩個地方寫同一份狀態**，
   * 而 `e2e/layout-preset-width.spec.ts` 記過那個病一次了。
   *
   * > **兩個地方寫同一個 inline 樣式，後寫的那個不知道自己在覆蓋一份狀態。**
   */
  private inGrid(): boolean {
    const parent = this.container.parentElement
    return !!parent && getComputedStyle(parent).display === 'grid'
  }

  private applyHeight(): void {
    // ⚠️ 收合仍然由這裡管——那是「內容顯不顯示」，不是「這一格多高」
    this.contentArea.style.display = this.collapsed ? 'none' : ''
    // grid 之下把手交給格線（`layout/grid-dividers.ts`），這條列自己的分隔線收起來
    this.divider.style.display = this.inGrid() ? 'none' : ''
    if (this.inGrid()) return
    this.container.style.flex = this.collapsed ? '0 0 auto' : `0 0 ${this.heightRatio * 100}%`
  }
}
