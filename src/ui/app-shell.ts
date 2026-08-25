import * as Blockly from 'blockly'
import { SplitPane } from './layout/split-pane'
import { BottomPanel } from './layout/bottom-panel'
import { LayoutManager } from './layout/layout-manager'
import { MobileTabBar, type TabId } from './layout/mobile-tab-bar'
import { ConsolePanel } from './panels/console-panel'
import { VariablePanel } from './panels/variable-panel'
import { FlowPanel } from './panels/flow-panel'
import { BlocklyPanel } from './panels/blockly-panel'
import type { CodeView } from '../core/host/code-view'
import type { HostProfile } from '../core/host/host-profile'
import { CONTROLS, RUN_MODES, drawnByPanel, panelControls, type ControlId } from '../core/host/controls'
import { QuickAccessBar } from './toolbar/quick-access-bar'
import { TopicSelector } from './toolbar/topic-selector'
import { StyleSelector } from './toolbar/style-selector'
import { BlockStyleSelector } from './toolbar/block-style-selector'
import { LocaleSelector } from './toolbar/locale-selector'
import { MobileMenu } from './toolbar/mobile-menu'
import { CodeKeyboard } from './panels/code-keyboard'
import type { StorageLike } from '../core/host/host-profile'
import type { SavedState } from '../core/storage'
import type { BlockSpecRegistry } from '../core/block-spec-registry'
import type { StylePreset, Target, Topic } from '../core/types'
import type { TopicRegistry } from '../core/topic-registry'
import type { TargetRegistry } from '../core/target-registry'
import type { BlockStylePreset } from '../languages/style'
import { showToast } from './toolbar/toast'

export interface AppShellElements {
  blocklyPanel: BlocklyPanel
  /**
   * 程式碼那一側的**角色**。
   *
   * ⚠️ 網頁版是內建的編輯器面板；而編輯器不歸我們管的宿主會給一個**代理**
   * ——`ui/app.ts` 與 `ui/execution-controller.ts` 只認識這個角色。
   */
  codeView: CodeView
  consolePanel: ConsolePanel
  variablePanel: VariablePanel
  flowPanel: FlowPanel
  bottomPanel: BottomPanel
  /** 🔴 **這個宿主可能一顆快速列控制項都沒有**——那時它不存在，不是空的。 */
  quickAccessBar: QuickAccessBar | null
  layoutManager: LayoutManager
  mobileTabBar: MobileTabBar | null
  mobileMenu: MobileMenu | null
  codeKeyboard: CodeKeyboard | null
}

export interface AppShellCallbacks {
  onTargetChange: (target: Target, topic: Topic, enabledBranches: Set<string>) => void
  onBranchesChange: (enabledBranches: Set<string>) => void
  onStyleChange: (style: StylePreset) => void
  onBlockStyleChange: (preset: BlockStylePreset, toolbox: object) => void
  onLocaleChange: (locale: string) => void
  /** 🔴 一個入口，而不是每個方向一顆——見 `core/sync-coordinator.ts` */
  onOpenSyncMenu: () => void
  onUndo: () => void
  onRedo: () => void
  onClear: () => void
  getExportState: () => SavedState
  importState: (state: SavedState) => void
  onUploadCustomBlocks: (blocks: object[]) => void
}

/**
 * 執行模式的選單標記——🔴 **由 `RUN_MODES` 產生，不再手寫**。
 *
 * ⚠️ 在此之前那份清單散在三處（這裡的標記、`execution-controller.ts` 的
 * 型別聯集與標籤查表），而宿主那側還要第四份。
 */
function runGroupMarkup(): string {
  const options = RUN_MODES.map((m) =>
    `${m.separatorBefore ? '<div class="run-mode-separator"></div>' : ''}` +
    `<div class="run-mode-option" data-mode="${m.id}">${m.label}</div>`).join('')
  return `<div class="run-group">
        <button id="run-btn" class="exec-btn run" title="執行">▶ 執行</button>
        <button id="run-mode-btn" class="exec-btn run run-mode-arrow" title="執行模式">▾</button>
        <div id="run-mode-menu" class="run-mode-menu" style="display:none">${options}</div>
      </div>`
}

export function createAppLayout(
  appEl: HTMLElement,
  blockSpecRegistry: BlockSpecRegistry,
  toolbox: object,
  /**
   * 🔴 這個宿主有什麼、沒有什麼。
   *
   * ⚠️ **不要在這個檔裡問「現在是哪一個宿主」** ——問 `profile.features`。
   * 一旦有人寫 `profile.id === '…'`，這份宣告就退化成一個標籤
   * （由 `tests/integration/host-contract.test.ts` 釘住）。
   */
  profile: HostProfile,
  /**
   * 🔴 **語言相關的東西一律從這裡透傳**（spec 153）——這個檔**不認得**它們。
   * 組裝點是 `app.ts`（護欄明寫「可見，不入棘輪」）。
   */
  languageWiring?: {
    buildProgramRoot?: (body: never[]) => never
    installExtractStrategies?: (extractor: never) => void
  }
): AppShellElements {
  const layoutManager = new LayoutManager()

  // Create toolbar
  //
  // 🔴 **每一顆控制項建不建，問登錄表**（`core/host/controls.ts`）——
  //    不是問「現在是哪個宿主」，也不是每一顆各給一格布林。
  //    ⚠️ 關掉 ＝ **不建那些 DOM**（FR-006），不是建了再藏起來。
  const surfaces = profile.controlSurfaces
  const inPanel = (id: ControlId): boolean => {
    const spec = CONTROLS.find((c) => c.id === id)
    return !!spec && drawnByPanel(spec, surfaces)
  }
  const headerActions = [
    inPanel('style') ? '<span id="style-selector-mount"></span>' : '',
    inPanel('locale') ? '<span id="locale-selector-mount"></span>' : '',
    inPanel('run') ? `<span class="toolbar-separator"></span>${runGroupMarkup()}` : '',
    // ⚠️ 這兩顆屬於行動版，不是控制項登錄表的成員——它們的開關一直是 `mobileLayout`。
    profile.features.mobileLayout
      ? '<button id="mobile-sync-btn" class="exec-btn auto-sync-on" title="自動同步：開啟" style="display:none">⇄ 自動</button>' +
        '<button id="hamburger-btn" class="hamburger-btn" title="選單">☰</button>'
      : '',
  ].join('')

  // 🔴 **一條沒有任何控制項的工具列，剩下的只有商標**——而分頁標題已經寫著
  //    「Semorphe 積木」。在一個窄面板裡那一條就是純粹的浪費。
  //    ⚠️ 所以是**不建**，同一條規則。
  let toolbar: HTMLElement | null = null
  if (headerActions !== '') {
    toolbar = document.createElement('header')
    toolbar.id = 'toolbar'
    toolbar.innerHTML = `
    <div class="toolbar-left">
      <img src="logo.svg" alt="Semorphe" class="toolbar-logo">
      <span class="toolbar-title">Semorphe</span>
    </div>
    <div class="toolbar-actions">${headerActions}</div>
  `
    appEl.appendChild(toolbar)
  }

  // Create main area with split pane
  const main = document.createElement('main')
  main.id = 'editors'
  appEl.appendChild(main)
  // 🔴 **方向由「有沒有程式碼那一格」決定**，不是另一個旗標。
  //    有：左右分（積木 ‖ 程式碼＋主控台）——網頁版。
  //    沒有：上下分（積木在上、主控台在下）——否則主控台會霸佔右半整條，
  //    而那不是「像網頁版」，是把空出來的位置留給了錯的東西。
  const splitPane = new SplitPane(main, profile.features.codeEditorPane ? 'horizontal' : 'vertical')

  // Create status bar
  // 🔴 關掉 ＝ **不建**（FR-006），不是建了再藏起來——宿主自己有一條。
  //    ⚠️ 而「不建」有一個義務跟著：三態要改由 `reportSyncPhase` 送出去，
  //       否則它會**安靜地消失**。見 `core/host/host-profile.ts` 的 `statusBar`。
  if (profile.controlSurfaces.indicator === 'panelStatusBar') {
    const statusBar = document.createElement('footer')
    statusBar.id = 'status-bar'
    statusBar.innerHTML = '<span>Loading...</span>'
    appEl.appendChild(statusBar)
  }

  // Left panel: QuickAccessBar + Blockly
  const leftPanel = splitPane.getLeftPanel()
  leftPanel.style.display = 'flex'
  leftPanel.style.flexDirection = 'column'

  // 🔴 一顆控制項都不剩的話**不建這條列**——一條空的列只是把版面吃掉。
  const quickAccessNeeded = panelControls(surfaces).some((c) => c.bar === 'quickAccess')
  const quickAccessBar = (quickAccessNeeded || profile.features.fileButtons)
    ? new QuickAccessBar(leftPanel, { fileButtons: profile.features.fileButtons, inPanel })
    : null

  const blocklyContainer = document.createElement('div')
  blocklyContainer.id = 'blockly-panel'
  blocklyContainer.style.flex = '1'
  blocklyContainer.style.overflow = 'hidden'
  leftPanel.appendChild(blocklyContainer)

  // 🔴 **`media` 不傳的話，Blockly 會去 `blockly-demo.appspot.com` 抓圖示與音效**
  // ——而離線時那些圖示會壞掉，壞得很安靜（只是變破圖，功能還在）。
  // ⚠️ 這個選項**本來就接好了**（`BlocklyPanel` 的 `media?`），只是從來沒有人傳。
  // 檔案由 `vite.config.ts` 從 `node_modules/blockly/media` 複製，
  // 由第四十五條護欄（`e2e/offline.spec.ts`）守著。
  const blocklyPanel = new BlocklyPanel({
    container: blocklyContainer,
    blockSpecRegistry,
    // 🔴 **透傳，不知道它是誰**（spec 153）——組裝點（`app.ts`）給的。
    buildProgramRoot: languageWiring?.buildProgramRoot as never,
    installExtractStrategies: languageWiring?.installExtractStrategies as never,
    // ⚠️ **環境差異**：網頁版從 base URL 取，而把應用嵌進別的宿主時
    //    檔案在別的地方。🔴 而它不是「要不要有」——兩邊都要有。
    media: (window as unknown as { __SEMORPHE_BLOCKLY_MEDIA__?: string })
      .__SEMORPHE_BLOCKLY_MEDIA__ ?? `${import.meta.env.BASE_URL}blockly-media/`,
  })
  blocklyPanel.init(toolbox)

  // Right panel: Monaco + BottomPanel
  const rightColumn = splitPane.getRightPanel()
  rightColumn.classList.add('right-column')

  const monacoWrapper = document.createElement('div')
  monacoWrapper.className = 'monaco-wrapper'
  monacoWrapper.id = 'monaco-panel'
  // 🔴 這一格若不存在，就**不佔版面**——不是藏起來，是不撐開。
  //    ⚠️ 而容器本身仍然要建：程式碼視圖的建構子收得到它
  //       （即使那個實作不在上面畫任何東西）。
  if (!profile.features.codeEditorPane) {
    monacoWrapper.style.flex = '0 0 0'
    monacoWrapper.style.height = '0'
    monacoWrapper.style.overflow = 'hidden'
  }
  rightColumn.appendChild(monacoWrapper)

  // 🔴 **由宿主決定這一格是誰**——這個檔不認識任何一個具體的編輯器。
  const codeView = profile.createCodeView(monacoWrapper)

  const bottomContainer = document.createElement('div')
  rightColumn.appendChild(bottomContainer)
  const bottomPanel = new BottomPanel(bottomContainer)

  const consoleEl = document.createElement('div')
  const consolePanel = new ConsolePanel(consoleEl)
  bottomPanel.addTab({
    id: 'console',
    label: Blockly.Msg['PANEL_CONSOLE'] || 'Console',
    panel: consoleEl,
    actions: [
      { icon: '📋', title: '複製輸出', onClick: () => consolePanel.copyOutput() },
      { icon: Blockly.Msg['PANEL_CLEAR'] || '清除', title: 'Clear', onClick: () => consolePanel.clear() },
    ],
  })

  const variableEl = document.createElement('div')
  const variablePanel = new VariablePanel(variableEl)
  bottomPanel.addTab({ id: 'variables', label: Blockly.Msg['PANEL_VARIABLES'] || 'Variables', panel: variableEl })

  // 🔴 **第三個投影**。它出現在這裡只是因為要有一格 DOM——
  //    接線由 `registerViewsIn` 掃出來（見下面的回傳物件），不是這裡硬接的。
  const flowEl = document.createElement('div')
  const flowPanel = new FlowPanel(flowEl, blockSpecRegistry)
  bottomPanel.addTab({ id: 'flow', label: Blockly.Msg['PANEL_FLOW'] || 'Flow', panel: flowEl })

  // Mobile layout: create mobile containers and tab bar
  // These are created once but only shown when in mobile mode
  const mobileBlocksContainer = document.createElement('div')
  mobileBlocksContainer.className = 'mobile-panel-container'
  mobileBlocksContainer.id = 'mobile-blocks'
  main.appendChild(mobileBlocksContainer)

  const mobileCodeContainer = document.createElement('div')
  mobileCodeContainer.className = 'mobile-panel-container'
  mobileCodeContainer.id = 'mobile-code'
  main.appendChild(mobileCodeContainer)

  const mobileConsoleContainer = document.createElement('div')
  mobileConsoleContainer.className = 'mobile-panel-container'
  mobileConsoleContainer.id = 'mobile-console'
  main.appendChild(mobileConsoleContainer)

  // 行動版的分頁列。
  //
  // 🔴 **`mobileLayout: false` 的宿主【不建它】** ——而那不只是美觀問題：
  // 網頁版靠 CSS 的寬度斷點切換版面，而**一塊面板天生就窄**
  // ——於是桌面的 IDE 裡會冒出手機的分頁列。
  //
  // ⚠️ 2026-08-18 使用者實測撞到：面板下方出現「積木／程式碼／主控台」，
  //    而 `features.mobileLayout` 明明宣告了 `false`
  //    ——**因為那個宣告從來沒有人消費**。
  //
  // > **一個宣告了而沒有人讀的能力旗標，與一個不存在的旗標，效果一樣
  // > ——差別只在前者看起來已經處理過了。**
  // 🔴 **CSS 那一半也要關掉。** 版面有兩半：這個檔（誰看得見）與
  // `style.css` 的 `@media (max-width: 768px)`（絕對定位、藏掉分隔線）。
  // 只關 JS 那一半，得到的是**半套行動版**——`.split-left` 被絕對定位蓋住，
  // 而沒有人來切換它的可見性，**積木畫布在 DOM 裡存在卻看不見**。
  document.body.classList.toggle('host-no-mobile-layout', !profile.features.mobileLayout)

  let mobileTabBar: MobileTabBar | null = null
  let tabBarContainer: HTMLElement | null = null
  if (profile.features.mobileLayout) {
    tabBarContainer = document.createElement('div')
    tabBarContainer.id = 'mobile-tab-bar-container'
    tabBarContainer.style.display = 'none'
    appEl.appendChild(tabBarContainer)
    mobileTabBar = new MobileTabBar(tabBarContainer)
  }

  // ─── Virtual Keyboards (touch devices) ───

  // 虛擬鍵盤——⚠️ 它要操作底層編輯器，而不是每個宿主都交得出來。
  const codeKeyboard = profile.features.codeKeyboard
    ? new CodeKeyboard(mobileCodeContainer)
    : null
  codeKeyboard?.setEditor(codeView.getEditor?.() as never)

  const consoleKeyboard = profile.features.codeKeyboard
    ? new CodeKeyboard(mobileConsoleContainer)
    : null

  // IME toggle buttons
  const createImeToggle = (parent: HTMLElement) => {
    const btn = document.createElement('button')
    btn.className = 'ime-toggle-btn'
    btn.textContent = '⌨'
    btn.title = '切換回程式鍵盤'
    btn.style.display = 'none'
    parent.appendChild(btn)
    return btn
  }
  const imeToggleBtn = createImeToggle(mobileCodeContainer)
  const consoleImeToggleBtn = createImeToggle(mobileConsoleContainer)
  // Desktop-touch IME toggle (lives in rightColumn)
  const desktopImeToggleBtn = createImeToggle(rightColumn)

  // Suppress native keyboard on a target element
  const suppressNativeKB = (el: HTMLElement | null) => {
    if (el) el.setAttribute('inputmode', 'none')
  }
  const restoreNativeKB = (el: HTMLElement | null) => {
    if (el) el.removeAttribute('inputmode')
  }
  const getMonacoTextarea = () =>
    monacoWrapper.querySelector('.monaco-editor .inputarea') as HTMLTextAreaElement | null

  // ── Code keyboard show/hide helpers ──

  const showCodeKeyboard = () => {
    codeKeyboard?.show()
    imeToggleBtn.style.display = 'none'
    desktopImeToggleBtn.style.display = 'none'
    suppressNativeKB(getMonacoTextarea())
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  }

  const showNativeIME = () => {
    codeKeyboard?.hide()
    // Show the appropriate toggle button
    if (layoutManager.getMode() === 'mobile') {
      imeToggleBtn.style.display = ''
    } else {
      desktopImeToggleBtn.style.display = ''
    }
    const textarea = getMonacoTextarea()
    restoreNativeKB(textarea)
    textarea?.focus()
    // ⚠️ 這個宿主可能沒有底層編輯器可以聚焦——`?.` 不是防禦，是「它本來就可能不存在」。
    const editor = codeView.getEditor?.() as { focus?: () => void } | null | undefined
    editor?.focus?.()
  }

  codeKeyboard?.onNativeIME(() => showNativeIME())
  codeKeyboard?.onCollapse(() => {
    // Show IME toggle so user can bring keyboard back
    imeToggleBtn.style.display = ''
    desktopImeToggleBtn.style.display = ''
  })
  imeToggleBtn.addEventListener('click', () => showCodeKeyboard())
  desktopImeToggleBtn.addEventListener('click', () => showCodeKeyboard())

  // ── Console keyboard show/hide helpers ──

  const showConsoleKeyboard = () => {
    const input = consolePanel.getInlineInput()
    if (!input) return
    consoleKeyboard?.show()
    consoleImeToggleBtn.style.display = 'none'
    suppressNativeKB(input)
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  }

  const showConsoleNativeIME = () => {
    consoleKeyboard?.hide()
    consoleImeToggleBtn.style.display = ''
    const input = consolePanel.getInlineInput()
    if (input) {
      restoreNativeKB(input)
      input.focus()
    }
  }

  consoleKeyboard?.onNativeIME(() => showConsoleNativeIME())
  consoleKeyboard?.onCollapse(() => {
    consoleImeToggleBtn.style.display = ''
  })
  consoleImeToggleBtn.addEventListener('click', () => showConsoleKeyboard())

  // ── Console input ↔ virtual keyboard wiring ──

  consolePanel.onInputShow((input) => {
    if (!layoutManager.isTouchDevice()) return
    if (layoutManager.getMode() === 'mobile') {
      // Mobile: use dedicated console keyboard
      suppressNativeKB(input)
      consoleKeyboard?.attachInput(input, () => consolePanel.submitCurrentInput())
      consoleKeyboard?.show()
    } else {
      // Desktop-touch: reuse codeKeyboard, switch to input mode
      suppressNativeKB(input)
      codeKeyboard?.attachInput(input, () => consolePanel.submitCurrentInput())
      // Keyboard is already visible; just switch target
    }
  })
  consolePanel.onInputHide(() => {
    if (layoutManager.getMode() === 'mobile') {
      consoleKeyboard?.detachInput()
      consoleKeyboard?.hide()
      consoleImeToggleBtn.style.display = 'none'
    } else {
      // Desktop-touch: revert codeKeyboard back to Monaco mode
      codeKeyboard?.detachInput()
    }
  })

  // Create mobile menu
  const hamburgerBtn = document.getElementById('hamburger-btn')
  let mobileMenu: MobileMenu | null = null
  // 🔴 沒有行動版版面就沒有漢堡選單——**連按鈕都不該在**（FR-006）。
  //    ⚠️ 2026-08-25 起它在**標記那一層**就不建了（見上面的 `headerActions`），
  //       所以這裡不再需要「建了再 remove」——那本來就是次好的做法。
  if (hamburgerBtn && toolbar) {
    mobileMenu = new MobileMenu(toolbar)
    hamburgerBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      mobileMenu!.toggle()
    })
  }

  // Selector mount points — saved for moving between toolbar ↔ mobile menu
  const selectorMounts = {
    topic: { id: 'level-selector-mount', label: '主題' },
    style: { id: 'style-selector-mount', label: '風格' },
    blockStyle: { id: 'block-style-selector-mount', label: '積木風格' },
    locale: { id: 'locale-selector-mount', label: '語言' },
  }

  // Remember original parent elements for each selector mount
  const selectorOriginalParents = new Map<string, { parent: HTMLElement; nextSibling: Node | null }>()

  // Panel DOM references for mobile switching
  const switchToMobile = () => {
    // 🔴 **這個宿主沒有行動版版面就【整段不跑】。**
    //
    // ⚠️ 網頁版靠 CSS 的寬度斷點切版面，而**一塊面板天生就窄**
    // ——桌面 IDE 裡因此會冒出手機的分頁列（2026-08-18 使用者實測撞到）。
    //
    // 而處置是**提前返回**，不是逐行加 `?.`：
    // > **一段「不該執行」的程式，讓它安全地執行完，
    // > 與讓它不執行，是兩件事——而前者會留下半套狀態。**
    if (!profile.features.mobileLayout) return
    // Move blockly panel elements to mobile container
    if (quickAccessBar) mobileBlocksContainer.appendChild(quickAccessBar.getElement())
    mobileBlocksContainer.appendChild(blocklyContainer)
    mobileBlocksContainer.classList.add('active')

    // Move monaco to mobile container (keyboard must stay below)
    mobileCodeContainer.insertBefore(monacoWrapper, codeKeyboard?.getElement() ?? null)
    mobileCodeContainer.classList.remove('active')

    // Move console/variable (bottom panel) to mobile container (keyboard must stay below)
    mobileConsoleContainer.insertBefore(bottomContainer, consoleKeyboard?.getElement() ?? null)
    mobileConsoleContainer.classList.remove('active')

    // Move selectors into mobile menu
    if (mobileMenu) {
      for (const info of Object.values(selectorMounts)) {
        const mount = document.getElementById(info.id)
        if (mount && mount.parentElement) {
          // Save original position for restoration
          selectorOriginalParents.set(info.id, {
            parent: mount.parentElement,
            nextSibling: mount.nextSibling,
          })
          mobileMenu.addSelectorMount(info.label, mount)
        }
      }
    }

    // Show tab bar
    if (tabBarContainer) tabBarContainer.style.display = ''

    // Show mobile sync button
    const mobileSyncBtn = document.getElementById('mobile-sync-btn')
    if (mobileSyncBtn) mobileSyncBtn.style.display = ''

    // Add toolbox collapse button
    let collapseBtn = document.getElementById('toolbox-collapse-btn')
    if (!collapseBtn) {
      collapseBtn = document.createElement('button')
      collapseBtn.id = 'toolbox-collapse-btn'
      collapseBtn.className = 'toolbox-collapse-btn'
      collapseBtn.textContent = '◀'
      const positionCollapseBtn = () => {
        const toolbox = blocklyContainer.querySelector('.blocklyToolbox') as HTMLElement | null
        if (!toolbox || !collapseBtn) return
        const isHidden = toolbox.style.display === 'none'
        collapseBtn.style.left = isHidden ? '0px' : `${toolbox.getBoundingClientRect().width}px`
      }
      collapseBtn.addEventListener('click', () => {
        const toolbox = blocklyContainer.querySelector('.blocklyToolbox') as HTMLElement | null
        if (!toolbox) return
        const isHidden = toolbox.style.display === 'none'
        toolbox.style.display = isHidden ? '' : 'none'
        collapseBtn!.textContent = isHidden ? '◀' : '▶'
        window.dispatchEvent(new Event('resize'))
        requestAnimationFrame(positionCollapseBtn)
      })
      mobileBlocksContainer.appendChild(collapseBtn)
      // Position after Blockly renders
      requestAnimationFrame(positionCollapseBtn)
      // Keep position in sync when toolbox resizes (e.g. category expand/collapse)
      const toolboxEl = blocklyContainer.querySelector('.blocklyToolbox') as HTMLElement | null
      if (toolboxEl) {
        new ResizeObserver(() => requestAnimationFrame(positionCollapseBtn)).observe(toolboxEl)
      }
      // Hide collapse button when toolbox flyout is open, show when closed
      const flyoutEl = blocklyContainer.querySelector('.blocklyToolboxFlyout') as SVGElement | null
      if (flyoutEl) {
        new MutationObserver(() => {
          const flyoutVisible = getComputedStyle(flyoutEl).display !== 'none'
          collapseBtn!.style.visibility = flyoutVisible ? 'hidden' : 'visible'
        }).observe(flyoutEl, { attributes: true, attributeFilter: ['style', 'display'] })
      }
    }
    collapseBtn.style.display = ''

    // Activate the current tab
    const activeTab = mobileTabBar!.getActiveTab()
    activateMobilePanel(activeTab)

    // Hide desktop layout elements
    leftPanel.style.display = 'none'
    rightColumn.style.display = 'none'

    // Apply mobile-friendly Monaco options (reduce IME issues)
    codeView.applyMobileOptions?.()

    // Move keyboards to mobile containers
    if (codeKeyboard) mobileCodeContainer.insertBefore(codeKeyboard.getElement(), imeToggleBtn)
    if (consoleKeyboard) mobileConsoleContainer.insertBefore(consoleKeyboard.getElement(), consoleImeToggleBtn)

    // Show code keyboard if code tab is active
    if (mobileTabBar!.getActiveTab() === 'code') {
      showCodeKeyboard()
    }

    window.dispatchEvent(new Event('resize'))
  }

  const switchToDesktop = () => {
    // 同上——沒有行動版就沒有「切回桌面版」這件事。
    if (!profile.features.mobileLayout) return
    // Move panels back to desktop containers (order matters: monaco before bottomPanel)
    if (quickAccessBar) leftPanel.appendChild(quickAccessBar.getElement())
    leftPanel.appendChild(blocklyContainer)
    // Ensure correct order: monaco first, then bottom panel
    rightColumn.appendChild(monacoWrapper)
    rightColumn.appendChild(bottomContainer)

    // Move selectors back to original toolbar positions
    for (const info of Object.values(selectorMounts)) {
      const mount = document.getElementById(info.id)
      const saved = selectorOriginalParents.get(info.id)
      if (mount && saved) {
        // Remove the mobile-menu-item wrapper
        const wrapper = mount.parentElement
        if (wrapper?.classList.contains('mobile-menu-item')) {
          if (saved.nextSibling) {
            saved.parent.insertBefore(mount, saved.nextSibling)
          } else {
            saved.parent.appendChild(mount)
          }
          wrapper.remove()
        }
      }
    }
    selectorOriginalParents.clear()

    // Hide mobile containers
    mobileBlocksContainer.classList.remove('active')
    mobileCodeContainer.classList.remove('active')
    mobileConsoleContainer.classList.remove('active')

    // Hide tab bar
    tabBarContainer!.style.display = 'none'

    // Hide mobile sync button
    const mobileSyncBtn = document.getElementById('mobile-sync-btn')
    if (mobileSyncBtn) mobileSyncBtn.style.display = 'none'

    // Hide toolbox collapse button and restore toolbox
    const collapseBtn = document.getElementById('toolbox-collapse-btn')
    if (collapseBtn) collapseBtn.style.display = 'none'
    const toolboxDiv = blocklyContainer.querySelector('.blocklyToolbox') as HTMLElement | null
    if (toolboxDiv) toolboxDiv.style.display = ''

    // Close mobile menu
    mobileMenu?.close()

    // Restore desktop layout
    leftPanel.style.display = 'flex'
    rightColumn.style.display = ''

    // Restore desktop Monaco options
    codeView.applyDesktopOptions?.()

    // Clean up mobile keyboards
    consoleKeyboard?.detachInput()
    consoleKeyboard?.hide()
    imeToggleBtn.style.display = 'none'
    consoleImeToggleBtn.style.display = 'none'

    if (layoutManager.isTouchDevice()) {
      // Desktop-touch: move code keyboard to right column, show it
      rightColumn.insertBefore(codeKeyboard!.getElement(), desktopImeToggleBtn)
      codeKeyboard?.detachInput()
      showCodeKeyboard()
    } else {
      // Desktop without touch: hide everything
      codeKeyboard?.hide()
      desktopImeToggleBtn.style.display = 'none'
      restoreNativeKB(getMonacoTextarea())
    }

    window.dispatchEvent(new Event('resize'))
  }

  const activateMobilePanel = (tab: TabId) => {
    mobileBlocksContainer.classList.toggle('active', tab === 'blocks')
    mobileCodeContainer.classList.toggle('active', tab === 'code')
    mobileConsoleContainer.classList.toggle('active', tab === 'console')
    // Use requestAnimationFrame to ensure DOM is fully updated before resize
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'))
    })
  }

  // Connect tab bar to panel switching
  //
  // 🔴 **用守衛，不用 `!`。** 我一度為了消掉型別錯誤把這裡寫成 `mobileTabBar!`
  // ——而預檢立刻炸：`Cannot read properties of null (reading 'onTabChange')`。
  //
  // > **機械地壓掉一個型別錯誤，是把它從編譯期搬到執行期。**
  mobileTabBar?.onTabChange((tab) => {
    activateMobilePanel(tab)
    // Show/hide code keyboard based on active tab
    if (tab === 'code') {
      showCodeKeyboard()
    } else {
      codeKeyboard?.hide()
      imeToggleBtn.style.display = 'none'
    }
  })

  // Handle mode changes
  layoutManager.onModeChange((mode) => {
    if (mode === 'mobile') {
      switchToMobile()
    } else {
      switchToDesktop()
    }
  })

  // Initial layout setup
  if (layoutManager.getMode() === 'mobile') {
    // Defer to after all initialization is complete
    requestAnimationFrame(() => switchToMobile())
  } else if (layoutManager.isTouchDevice()) {
    // Desktop-touch: show code keyboard in right column on initial load
    requestAnimationFrame(() => {
      rightColumn.insertBefore(codeKeyboard!.getElement(), desktopImeToggleBtn)
      showCodeKeyboard()
    })
  }

  return { blocklyPanel, codeView, consolePanel, variablePanel, flowPanel, bottomPanel, quickAccessBar, layoutManager, mobileTabBar, mobileMenu, codeKeyboard }
}

export function setupSelectors(
  stylePresets: StylePreset[],
  targetRegistry: TargetRegistry,
  topicRegistry: TopicRegistry,
  currentTarget: Target,
  currentBranches: Set<string>,
  callbacks: Pick<AppShellCallbacks, 'onTargetChange' | 'onBranchesChange' | 'onStyleChange' | 'onBlockStyleChange' | 'onLocaleChange'>,
): { topicSelector: TopicSelector | null; styleSelector: StyleSelector | null } {
  let topicSelector: TopicSelector | null = null
  let styleSelector: StyleSelector | null = null

  const topicMount = document.getElementById('level-selector-mount')
  if (topicMount) {
    // ⚠️ 課程清單由目標**查出來**，不再由使用者直接選——目標就是那個具名的配對。
    const topicOf = (t: Target): Topic => topicRegistry.get(t.topic)!
    topicSelector = new TopicSelector(topicMount, targetRegistry.all(), topicOf, currentTarget, currentBranches)
    topicSelector.onTargetChange((target, topic, branches) => callbacks.onTargetChange(target, topic, branches))
    topicSelector.onBranchesChange((branches) => callbacks.onBranchesChange(branches))
  }

  const styleMount = document.getElementById('style-selector-mount')
  if (styleMount) {
    styleSelector = new StyleSelector(styleMount, stylePresets)
    styleSelector.onChange(callbacks.onStyleChange)
  }

  const blockStyleMount = document.getElementById('block-style-selector-mount')
  if (blockStyleMount) {
    const selector = new BlockStyleSelector(blockStyleMount)
    selector.onChange((preset: BlockStylePreset) => {
      callbacks.onBlockStyleChange(preset, {})
    })
  }

  const localeMount = document.getElementById('locale-selector-mount')
  if (localeMount) {
    const selector = new LocaleSelector(localeMount)
    selector.onChange(async (locale) => {
      callbacks.onLocaleChange(locale)
    })
  }

  return { topicSelector, styleSelector }
}

export function setupToolbarButtons(callbacks: Pick<AppShellCallbacks, 'onOpenSyncMenu' | 'onUndo' | 'onRedo' | 'onClear'>): void {
  const replaceBtn = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      const clone = el.cloneNode(true) as HTMLElement
      el.parentNode?.replaceChild(clone, el)
      return clone
    }
    return null
  }

  replaceBtn('sync-menu-btn')?.addEventListener('click', callbacks.onOpenSyncMenu)
  replaceBtn('undo-btn')?.addEventListener('click', callbacks.onUndo)
  replaceBtn('redo-btn')?.addEventListener('click', callbacks.onRedo)
  replaceBtn('clear-btn')?.addEventListener('click', callbacks.onClear)

  // Mobile sync button — toggles auto-sync (same as desktop)
  replaceBtn('mobile-sync-btn')?.addEventListener('click', callbacks.onOpenSyncMenu)
}

export function setupFileButtons(
  storageService: StorageLike,
  callbacks: Pick<AppShellCallbacks, 'getExportState' | 'importState' | 'onUploadCustomBlocks'>,
): void {
  // File dropdown menu toggle
  const fileMenuBtn = document.getElementById('file-menu-btn')
  const fileMenu = document.getElementById('file-menu')
  if (fileMenuBtn && fileMenu) {
    fileMenuBtn.addEventListener('click', () => {
      fileMenu.style.display = fileMenu.style.display === 'none' ? 'block' : 'none'
    })
    document.addEventListener('click', (e) => {
      if (!fileMenuBtn.contains(e.target as Node) && !fileMenu.contains(e.target as Node)) {
        fileMenu.style.display = 'none'
      }
    })
  }

  const closeMenu = () => { if (fileMenu) fileMenu.style.display = 'none' }

  document.getElementById('export-btn')?.addEventListener('click', () => {
    closeMenu()
    const state = callbacks.getExportState()
    const blob = storageService.exportToBlob!(state)
    storageService.downloadBlob!(blob, `semorphe-${Date.now()}.json`)
    showToast(Blockly.Msg['TOAST_EXPORT_SUCCESS'] || '已匯出', 'success')
  })

  document.getElementById('import-btn')?.addEventListener('click', () => {
    closeMenu()
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        const state = storageService.importFromJSON!(reader.result as string)
        if (!state) {
          showToast(Blockly.Msg['TOAST_IMPORT_ERROR'] || '匯入失敗：無效的 JSON', 'error')
          return
        }
        callbacks.importState(state)
        showToast(Blockly.Msg['TOAST_IMPORT_SUCCESS'] || '已匯入', 'success')
      }
      reader.readAsText(file)
    })
    input.click()
  })

  document.getElementById('upload-blocks-btn')?.addEventListener('click', () => {
    closeMenu()
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const blocks = JSON.parse(reader.result as string)
          if (!Array.isArray(blocks)) {
            showToast(Blockly.Msg['TOAST_UPLOAD_ERROR'] || 'Invalid format: expected an array of block definitions', 'error')
            return
          }
          for (const blockDef of blocks) {
            if (!blockDef.type) {
              showToast(Blockly.Msg['TOAST_UPLOAD_ERROR'] || 'Invalid block: missing type', 'error')
              return
            }
          }
          callbacks.onUploadCustomBlocks(blocks)
        } catch {
          showToast(Blockly.Msg['TOAST_UPLOAD_ERROR'] || 'Failed to parse JSON file', 'error')
        }
      }
      reader.readAsText(file)
    })
    input.click()
  })
}

export function updateStatusBar(
  currentStylePreset: StylePreset,
  currentLocale: string,
  currentBlockStyleId: string,
  topicName: string,
  mobileMenu?: MobileMenu | null,
  /**
   * 目前語言的顯示名。
   *
   * 🔴 **原本這裡寫死 `'C++'`**——視圖層寫死一個語言的名字（P9 第一項）。
   * 症狀是切到 Python 之後狀態列仍然說「C++ | … | Python 入門」，
   * **而全套測試綠**：沒有任何一支在看那一行字。
   * > **一個只出現在狀態列的字串，只有截圖抓得到。**
   */
  languageName = 'C++',
  /**
   * 同步的三態。🔴 **它必須一直看得見**——
   * 一個沒被顯示的狀態，使用者會當成壞掉（開機誤報那一刀的同一條）。
   */
  sync?: { phase: 'live' | 'paused' | 'diverged'; source: string | null },
  /**
   * 回傳**扣掉三態的那一段**（語言｜風格｜積木風格｜主題｜語系）。
   *
   * 🔴 為什麼要回傳：不畫狀態列的宿主**仍然要拿得到這些字**
   * ——它們進宿主狀態列的 tooltip。
   * ⚠️ **「不畫」不等於「不算」**：一旦這裡提早 return，那些資訊就真的沒了。
   */
): string {
  const styleName = currentStylePreset.name[currentLocale] || currentStylePreset.name['zh-TW'] || currentStylePreset.id
  const blockStyleLabel = (Blockly.Msg as Record<string, string>)[`BLOCK_STYLE_${currentBlockStyleId.toUpperCase()}`] || currentBlockStyleId
  const syncText = sync
    ? sync.phase === 'paused'
      ? ` | ⏸ ${(Blockly.Msg as Record<string, string>)['SYNC_STATE_PAUSED'] || '已暫停'}`
      : sync.phase === 'diverged'
        ? ` | ⚠️ ${(Blockly.Msg as Record<string, string>)['SYNC_STATE_DIVERGED'] || '兩邊都改了'}`
        : ` | ⇄ ${(Blockly.Msg as Record<string, string>)['SYNC_STATE_LIVE'] || '同步中'}`
    : ''
  const contextText = `${languageName} | ${styleName} | ${blockStyleLabel} | ${topicName} | ${currentLocale}`
  const summaryText = `${contextText}${syncText}`

  const statusBar = document.getElementById('status-bar')
  if (statusBar) {
    statusBar.innerHTML = `<span>${summaryText}</span>`
  }

  // Also update mobile menu summary (visible when status bar is hidden)
  if (mobileMenu) {
    mobileMenu.setSummary(summaryText)
  }

  return contextText
}
