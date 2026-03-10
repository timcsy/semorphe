import * as Blockly from 'blockly'
import { SplitPane } from './layout/split-pane'
import { BottomPanel } from './layout/bottom-panel'
import { ConsolePanel } from './panels/console-panel'
import { VariablePanel } from './panels/variable-panel'
import { BlocklyPanel } from './panels/blockly-panel'
import { MonacoPanel } from './panels/monaco-panel'
import { QuickAccessBar } from './toolbar/quick-access-bar'
import { LevelSelector } from './toolbar/level-selector'
import { StyleSelector } from './toolbar/style-selector'
import { BlockStyleSelector } from './toolbar/block-style-selector'
import { LocaleSelector } from './toolbar/locale-selector'
import { StorageService } from '../core/storage'
import type { SavedState } from '../core/storage'
import type { BlockSpecRegistry } from '../core/block-spec-registry'
import type { StylePreset, CognitiveLevel } from '../core/types'
import type { BlockStylePreset } from '../languages/style'
import { showToast } from './toolbar/toast'

export interface AppShellElements {
  blocklyPanel: BlocklyPanel
  monacoPanel: MonacoPanel
  consolePanel: ConsolePanel
  variablePanel: VariablePanel
  bottomPanel: BottomPanel
  quickAccessBar: QuickAccessBar
}

export interface AppShellCallbacks {
  onLevelChange: (level: CognitiveLevel) => void
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
  // Create toolbar
  const toolbar = document.createElement('header')
  toolbar.id = 'toolbar'
  toolbar.innerHTML = `
    <div class="toolbar-left">
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
    actions: [{ icon: Blockly.Msg['PANEL_CLEAR'] || '清除', title: 'Clear', onClick: () => consolePanel.clear() }],
  })

  const variableEl = document.createElement('div')
  const variablePanel = new VariablePanel(variableEl)
  bottomPanel.addTab({ id: 'variables', label: Blockly.Msg['PANEL_VARIABLES'] || 'Variables', panel: variableEl })

  return { blocklyPanel, monacoPanel, consolePanel, variablePanel, bottomPanel, quickAccessBar }
}

export function setupSelectors(
  stylePresets: StylePreset[],
  currentLevel: CognitiveLevel,
  callbacks: Pick<AppShellCallbacks, 'onLevelChange' | 'onStyleChange' | 'onBlockStyleChange' | 'onLocaleChange'>,
): { levelSelector: LevelSelector | null; styleSelector: StyleSelector | null } {
  let levelSelector: LevelSelector | null = null
  let styleSelector: StyleSelector | null = null

  const levelMount = document.getElementById('level-selector-mount')
  if (levelMount) {
    levelSelector = new LevelSelector(levelMount)
    levelSelector.setLevel(currentLevel)
    levelSelector.onChange(callbacks.onLevelChange)
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

  return { levelSelector, styleSelector }
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
  currentLevel: CognitiveLevel,
): void {
  const statusBar = document.getElementById('status-bar')
  if (!statusBar) return
  const styleName = currentStylePreset.name[currentLocale] || currentStylePreset.name['zh-TW'] || currentStylePreset.id
  const blockStyleLabel = (Blockly.Msg as Record<string, string>)[`BLOCK_STYLE_${currentBlockStyleId.toUpperCase()}`] || currentBlockStyleId
  const levelLabel = `L${currentLevel}`
  statusBar.innerHTML = `<span>C++ | ${styleName} | ${blockStyleLabel} | ${levelLabel} | ${currentLocale}</span>`
}
