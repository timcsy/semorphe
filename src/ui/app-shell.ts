import * as Blockly from 'blockly'
import { SplitPane } from './layout/split-pane'
import { BottomPanel } from './layout/bottom-panel'
import { LayoutManager } from './layout/layout-manager'
import { MobileTabBar, type TabId } from './layout/mobile-tab-bar'
import { ConsolePanel } from './panels/console-panel'
import { VariablePanel } from './panels/variable-panel'
import { BlocklyPanel } from './panels/blockly-panel'
import { MonacoPanel } from './panels/monaco-panel'
import { QuickAccessBar } from './toolbar/quick-access-bar'
import { TopicSelector } from './toolbar/topic-selector'
import { StyleSelector } from './toolbar/style-selector'
import { BlockStyleSelector } from './toolbar/block-style-selector'
import { LocaleSelector } from './toolbar/locale-selector'
import { MobileMenu } from './toolbar/mobile-menu'
import { StorageService } from '../core/storage'
import type { SavedState } from '../core/storage'
import type { BlockSpecRegistry } from '../core/block-spec-registry'
import type { StylePreset, Topic } from '../core/types'
import type { TopicRegistry } from '../core/topic-registry'
import type { BlockStylePreset } from '../languages/style'
import { showToast } from './toolbar/toast'

export interface AppShellElements {
  blocklyPanel: BlocklyPanel
  monacoPanel: MonacoPanel
  consolePanel: ConsolePanel
  variablePanel: VariablePanel
  bottomPanel: BottomPanel
  quickAccessBar: QuickAccessBar
  layoutManager: LayoutManager
  mobileTabBar: MobileTabBar | null
  mobileMenu: MobileMenu | null
}

export interface AppShellCallbacks {
  onTopicChange: (topic: Topic, enabledBranches: Set<string>) => void
  onBranchesChange: (enabledBranches: Set<string>) => void
  onStyleChange: (style: StylePreset) => void
  onBlockStyleChange: (preset: BlockStylePreset, toolbox: object) => void
  onLocaleChange: (locale: string) => void
  onSyncBlocks: () => void
  onSyncCode: () => void
  onToggleAutoSync: () => void
  onUndo: () => void
  onRedo: () => void
  onClear: () => void
  getExportState: () => SavedState
  importState: (state: SavedState) => void
  onUploadCustomBlocks: (blocks: object[]) => void
}

export function createAppLayout(
  appEl: HTMLElement,
  blockSpecRegistry: BlockSpecRegistry,
  toolbox: object,
): AppShellElements {
  const layoutManager = new LayoutManager()

  // Create toolbar
  const toolbar = document.createElement('header')
  toolbar.id = 'toolbar'
  toolbar.innerHTML = `
    <div class="toolbar-left">
      <img src="logo.svg" alt="Semorphe" class="toolbar-logo">
      <span class="toolbar-title">Semorphe</span>
    </div>
    <div class="toolbar-actions">
      <span id="style-selector-mount"></span>
      <span id="locale-selector-mount"></span>
      <span class="toolbar-separator"></span>
      <div class="run-group">
        <button id="run-btn" class="exec-btn run" title="執行">▶ 執行</button>
        <button id="run-mode-btn" class="exec-btn run run-mode-arrow" title="執行模式">▾</button>
        <div id="run-mode-menu" class="run-mode-menu" style="display:none">
          <div class="run-mode-option" data-mode="run">▶ 執行</div>
          <div class="run-mode-option" data-mode="debug">🔍 除錯</div>
          <div class="run-mode-separator"></div>
          <div class="run-mode-option" data-mode="animate-slow">▷ 動畫（慢）</div>
          <div class="run-mode-option" data-mode="animate-medium">▷ 動畫（中）</div>
          <div class="run-mode-option" data-mode="animate-fast">▷ 動畫（快）</div>
          <div class="run-mode-separator"></div>
          <div class="run-mode-option" data-mode="step">⏭ 逐步</div>
        </div>
      </div>
      <button id="mobile-sync-btn" class="exec-btn auto-sync-on" title="自動同步：開啟" style="display:none">⇄ 自動</button>
      <button id="hamburger-btn" class="hamburger-btn" title="選單">☰</button>
    </div>
  `
  appEl.appendChild(toolbar)

  // Create main area with split pane
  const main = document.createElement('main')
  main.id = 'editors'
  appEl.appendChild(main)
  const splitPane = new SplitPane(main)

  // Create status bar
  const statusBar = document.createElement('footer')
  statusBar.id = 'status-bar'
  statusBar.innerHTML = '<span>Loading...</span>'
  appEl.appendChild(statusBar)

  // Left panel: QuickAccessBar + Blockly
  const leftPanel = splitPane.getLeftPanel()
  leftPanel.style.display = 'flex'
  leftPanel.style.flexDirection = 'column'

  const quickAccessBar = new QuickAccessBar(leftPanel)

  const blocklyContainer = document.createElement('div')
  blocklyContainer.id = 'blockly-panel'
  blocklyContainer.style.flex = '1'
  blocklyContainer.style.overflow = 'hidden'
  leftPanel.appendChild(blocklyContainer)

  const blocklyPanel = new BlocklyPanel({ container: blocklyContainer, blockSpecRegistry })
  blocklyPanel.init(toolbox)

  // Right panel: Monaco + BottomPanel
  const rightColumn = splitPane.getRightPanel()
  rightColumn.classList.add('right-column')

  const monacoWrapper = document.createElement('div')
  monacoWrapper.className = 'monaco-wrapper'
  monacoWrapper.id = 'monaco-panel'
  rightColumn.appendChild(monacoWrapper)

  const monacoPanel = new MonacoPanel(monacoWrapper)
  monacoPanel.init(false)

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

  // Create mobile tab bar (hidden in desktop via CSS)
  let mobileTabBar: MobileTabBar | null = null
  const tabBarContainer = document.createElement('div')
  tabBarContainer.id = 'mobile-tab-bar-container'
  tabBarContainer.style.display = 'none'
  appEl.appendChild(tabBarContainer)
  mobileTabBar = new MobileTabBar(tabBarContainer)

  // Create mobile menu
  const hamburgerBtn = document.getElementById('hamburger-btn')
  let mobileMenu: MobileMenu | null = null
  if (hamburgerBtn) {
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
    // Move blockly panel elements to mobile container
    mobileBlocksContainer.appendChild(quickAccessBar.getElement())
    mobileBlocksContainer.appendChild(blocklyContainer)
    mobileBlocksContainer.classList.add('active')

    // Move monaco to mobile container
    mobileCodeContainer.appendChild(monacoWrapper)
    mobileCodeContainer.classList.remove('active')

    // Move console/variable (bottom panel) to mobile container
    mobileConsoleContainer.appendChild(bottomContainer)
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
    tabBarContainer.style.display = ''

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
    monacoPanel.applyMobileOptions()

    window.dispatchEvent(new Event('resize'))
  }

  const switchToDesktop = () => {
    // Move panels back to desktop containers (order matters: monaco before bottomPanel)
    leftPanel.appendChild(quickAccessBar.getElement())
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
    tabBarContainer.style.display = 'none'

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
    monacoPanel.applyDesktopOptions()

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
  mobileTabBar.onTabChange((tab) => {
    activateMobilePanel(tab)
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
  }

  return { blocklyPanel, monacoPanel, consolePanel, variablePanel, bottomPanel, quickAccessBar, layoutManager, mobileTabBar, mobileMenu }
}

export function setupSelectors(
  stylePresets: StylePreset[],
  topicRegistry: TopicRegistry,
  currentTopic: Topic,
  currentBranches: Set<string>,
  callbacks: Pick<AppShellCallbacks, 'onTopicChange' | 'onBranchesChange' | 'onStyleChange' | 'onBlockStyleChange' | 'onLocaleChange'>,
): { topicSelector: TopicSelector | null; styleSelector: StyleSelector | null } {
  let topicSelector: TopicSelector | null = null
  let styleSelector: StyleSelector | null = null

  const topicMount = document.getElementById('level-selector-mount')
  if (topicMount) {
    const topics = topicRegistry.listForLanguage(currentTopic.language)
    topicSelector = new TopicSelector(topicMount, topics, currentTopic, currentBranches)
    topicSelector.onTopicChange((topic, branches) => callbacks.onTopicChange(topic, branches))
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

export function setupToolbarButtons(callbacks: Pick<AppShellCallbacks, 'onSyncBlocks' | 'onSyncCode' | 'onToggleAutoSync' | 'onUndo' | 'onRedo' | 'onClear'>): void {
  const replaceBtn = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      const clone = el.cloneNode(true) as HTMLElement
      el.parentNode?.replaceChild(clone, el)
      return clone
    }
    return null
  }

  replaceBtn('auto-sync-btn')?.addEventListener('click', callbacks.onToggleAutoSync)
  replaceBtn('sync-blocks-btn')?.addEventListener('click', callbacks.onSyncBlocks)
  replaceBtn('sync-code-btn')?.addEventListener('click', callbacks.onSyncCode)
  replaceBtn('undo-btn')?.addEventListener('click', callbacks.onUndo)
  replaceBtn('redo-btn')?.addEventListener('click', callbacks.onRedo)
  replaceBtn('clear-btn')?.addEventListener('click', callbacks.onClear)

  // Mobile sync button — toggles auto-sync (same as desktop)
  replaceBtn('mobile-sync-btn')?.addEventListener('click', callbacks.onToggleAutoSync)
}

export function setupFileButtons(
  storageService: StorageService,
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
    const blob = storageService.exportToBlob(state)
    storageService.downloadBlob(blob, `semorphe-${Date.now()}.json`)
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
        const state = storageService.importFromJSON(reader.result as string)
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
): void {
  const styleName = currentStylePreset.name[currentLocale] || currentStylePreset.name['zh-TW'] || currentStylePreset.id
  const blockStyleLabel = (Blockly.Msg as Record<string, string>)[`BLOCK_STYLE_${currentBlockStyleId.toUpperCase()}`] || currentBlockStyleId
  const summaryText = `C++ | ${styleName} | ${blockStyleLabel} | ${topicName} | ${currentLocale}`

  const statusBar = document.getElementById('status-bar')
  if (statusBar) {
    statusBar.innerHTML = `<span>${summaryText}</span>`
  }

  // Also update mobile menu summary (visible when status bar is hidden)
  if (mobileMenu) {
    mobileMenu.setSummary(summaryText)
  }
}
