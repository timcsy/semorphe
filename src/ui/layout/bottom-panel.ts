import { createPanelHead } from './cell-head'
import type { ConsoleSurface } from '../../core/host/console-surface'

export interface TabAction {
  icon: string
  title: string
  onClick: () => void
  /** ⚠️ 給測試與樣式用的識別字（`data-action`）——沒有也可以。 */
  id?: string
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
  private panelActionsArea: HTMLElement
  private contentArea: HTMLElement
  private divider: HTMLElement
  private tabs: TabDefinition[] = []
  private activeTabId: string | null = null
  private isDragging = false
  private collapsed = true
  private collapsible = true
  private heightRatio = 0.35
  /**
   * **這一條就是整個視窗**（2026-09-02，spec 171）。
   *
   * 🔴 在 IDE 的 panel 區裡，主控台那個視圖裡**沒有編輯區**——它整個 webview
   * 就是這一條。實測第一版：`#editors` 空著佔了 585px，而主控台只有 315px
   * （使用者截圖裡那一大片空白）。
   *
   * ⚠️ 獨佔的時候三件事跟著變：不收合（宿主自己有那顆關閉）、
   * 沒有自己的分隔線（沒有東西在它上面）、高度**吃滿**而不是 35%。
   */
  private solo = false
  /** 🔴 最大化＝編輯區讓出來，而這一條吃滿（見 `app-shell` 的 `installPanelActions`）。 */
  private maximized = false
  /** 🔴 **整條不見**（按 ✕ 或版面選單的「隱藏…」）——與 `collapsed`（只收內容）不同。 */
  private hidden = false
  /**
   * 🔴 **看得見的那一頁變了要出聲**（2026-09-02）。
   *
   * 使用者按了 ✕ 之後，版面選單上還寫著「隱藏主控台面板」——**它已經關了**。
   * 因為那個標籤是**算出來的**，而算它的人不知道剛才發生了什麼。
   *
   * > **一個會說「現在是什麼狀態」的標籤，要有人在狀態變的時候叫它重算
   * > ——否則它說的是【上一次有人問的時候】的狀態。**
   */
  private visibilityCb: (() => void) | null = null

  onVisibilityChange(cb: () => void): void {
    this.visibilityCb = cb
  }

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

    // 🔴 **面板自己的動作**（最大化／關閉）——⚠️ 與**分頁的**動作分開放
    //    （2026-09-02，使用者要「網頁版也有這個」，指的是 VSCode 面板右上那兩顆）。
    //
    //    分頁的動作（複製、清除）**換分頁就換一組**，而這兩顆是**面板的**：
    //    不管你在看主控台還是變數，它們都在那裡、意思都一樣。
    //
    // > **一個放在同一條列上的按鈕，如果它的意思不隨分頁改變，
    // > 它就不該跟著分頁被重畫。**
    this.panelActionsArea = document.createElement('div')
    this.panelActionsArea.className = 'bottom-panel-actions'
    this.tabBar.appendChild(this.panelActionsArea)

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
  /**
   * **現在看得見的是哪一頁**——收起來時是 `null`。
   *
   * ⚠️ 「面板開著」與「這一頁看得見」是兩件事：這一條有兩個分頁，
   * 開著的時候也只有**作用中的那一頁**看得見。
   */
  get visibleTab(): string | null {
    return this.hidden || this.collapsed ? null : this.activeTabId
  }

  /** 最大化：編輯區已經讓出來了，這一條吃滿高度。⚠️ 收合狀態不動。 */
  setMaximized(v: boolean): void {
    this.maximized = v
    if (v) this.collapsed = false
    this.applyHeight()
  }

  /** 見 `solo` 的說明：這一條就是整個視窗。 */
  setSolo(v: boolean): void {
    this.solo = v
    if (v) { this.collapsible = false; this.collapsed = false }
    this.applyHeight()
  }

  setCollapsible(v: boolean): void {
    this.collapsible = v
    if (!v && this.collapsed && this.activeTabId) this.showTab(this.activeTabId)
  }

  /**
   * **這一格當成「主控台這個表面」**（spec 171）。
   *
   * 🔴 `collapsed` 就是「使用者把它關掉了」——而 `show()` 要把它展開，
   * 不是把它建出來（它一直在，只是收著）。
   *
   * ⚠️ `show()` 在**已經開著時必須是 no-op**：印一百行不該跳一百次，
   * 也不該搶焦點。
   */
  asConsoleSurface(): ConsoleSurface {
    return {
      show: () => {
        this.hidden = false
        if (this.collapsed) {
          if (this.activeTabId) this.showTab(this.activeTabId)
          else if (this.tabs[0]) this.showTab(this.tabs[0].id)
        }
        this.applyHeight()
        window.dispatchEvent(new Event('resize'))
      },
      hide: () => {
        // 🔴 **關掉＝整條不見，連分頁列一起**（2026-09-02）。
        //
        //    使用者按了 ✕ 之後看到分頁列還留在最底下：「**為何我按 x 變這樣**？」
        //    ——而他是對的：VSCode 的 ✕ 關的是**整個面板**，不是「把內容收起來
        //    而留一條」。留著那一條的是**點分頁**那個動作（收合），兩者不同。
        //
        // > **「收起來」與「關掉」的差別，在畫面上就是那條列還在不在
        // > ——而使用者按的那顆叉，指的一定是後者。**
        //
        // ⚠️ 那它怎麼回來？版面選單的「顯示…面板」，以及**有輸出時自己回來**。
        this.hidden = true
        this.applyHeight()
        window.dispatchEvent(new Event('resize'))
      },
      isHidden: () => this.hidden || this.collapsed,
    }
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
    // 🔴 **「顯示這一頁」當然包含「這一條要在」**（2026-09-02）。
    //
    //    使用者按了版面選單的「顯示主控台面板」而**沒反應**——因為這裡只解了
    //    `collapsed`，而整條是被 `hidden` 關掉的（按 ✕ 的那一種）。
    //
    // > **一個東西有兩種「看不見」的時候，「顯示」必須把兩種都解掉
    // > ——只解一種的下場，是使用者按了而畫面完全不動。**
    this.hidden = false
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

  /**
   * **面板自己的那幾顆**（最大化／關閉）——與分頁的動作分開，換分頁不重畫。
   *
   * ⚠️ 傳空陣列就是「這個宿主不畫它們」：IDE 那側有宿主自己的同名按鈕，
   * 我們再畫一份就是同一件事講兩次。
   */
  setPanelActions(actions: readonly TabAction[]): void {
    this.panelActionsArea.innerHTML = ''
    for (const action of actions) {
      const btn = document.createElement('button')
      btn.className = 'bottom-panel-action-btn'
      btn.title = action.title
      btn.textContent = action.icon
      btn.dataset.action = action.id ?? ''
      btn.addEventListener('click', action.onClick)
      this.panelActionsArea.appendChild(btn)
    }
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
    // ⚠️ **每一條改變「看得見的是哪一頁」的路徑都會走到這裡**——收合、關閉、
    //    最大化、切分頁——所以出聲放這裡一次就夠，不必每個呼叫點各記一次。
    this.visibilityCb?.()
    // 🔴 整條不見的時候，下面每一條「多高」都不必算了。
    this.container.style.display = this.hidden ? 'none' : ''
    if (this.hidden) return
    // ⚠️ 收合仍然由這裡管——那是「內容顯不顯示」，不是「這一格多高」
    this.contentArea.style.display = this.collapsed ? 'none' : ''
    // grid 之下把手交給格線（`layout/grid-dividers.ts`），這條列自己的分隔線收起來
    // ⚠️ 最大化時那條把手沒有東西可以拖（上面沒有編輯區了）。
    this.divider.style.display = this.inGrid() || this.solo || this.maximized ? 'none' : ''
    if (this.inGrid()) return
    // 🔴 獨佔時吃滿——`0 0 35%` 會在一個沒有編輯區的視窗裡留下 65% 的空白。
    this.container.style.flex = this.solo || this.maximized ? '1 1 auto'
      : this.collapsed ? '0 0 auto' : `0 0 ${this.heightRatio * 100}%`
  }
}
