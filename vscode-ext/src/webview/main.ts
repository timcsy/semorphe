import * as Blockly from 'blockly'
import type { CognitiveLevel, ConceptDefJSON, BlockProjectionJSON, StylePreset } from '../../../src/core/types'
import type { SemanticNode } from '../../../src/core/types'
import { BlockSpecRegistry } from '../../../src/core/block-spec-registry'
import { BlocklyPanel } from '../../../src/ui/panels/blockly-panel'
import { VscodeBlocklyPanel } from './blockly-setup'
import { BlockRegistrar } from '../../../src/ui/block-registrar'
import { buildToolbox } from '../../../src/ui/toolbox-builder'
import { CATEGORY_COLORS } from '../../../src/ui/theme/category-colors'
import { PatternRenderer } from '../../../src/core/projection/pattern-renderer'
import { PatternExtractor } from '../../../src/core/projection/pattern-extractor'
import { setPatternRenderer } from '../../../src/core/projection/block-renderer'
import { renderToBlocklyState } from '../../../src/core/projection/block-renderer'
import { RenderStrategyRegistry } from '../../../src/core/registry/render-strategy-registry'
import { registerCppRenderStrategies } from '../../../src/languages/cpp/renderers/strategies'
import { LocaleLoader } from '../../../src/i18n/loader'
import { LevelSelector } from '../../../src/ui/toolbar/level-selector'
import { StyleSelector } from '../../../src/ui/toolbar/style-selector'
import { BlockStyleSelector } from '../../../src/ui/toolbar/block-style-selector'
import type { BlockStylePreset } from '../../../src/languages/style'
import { runDiagnostics } from '../../../src/core/diagnostics'
import type { DiagnosticBlock } from '../../../src/core/diagnostics'
import { send, onMessage } from './bridge-client'

// i18n
import zhTWBlocks from '../../../src/i18n/zh-TW/blocks.json'
import zhTWTypes from '../../../src/i18n/zh-TW/types.json'

// Concept JSONs
import universalConcepts from '../../../src/blocks/semantics/universal-concepts.json'
import { coreConcepts } from '../../../src/languages/cpp/core'
import { allStdModules } from '../../../src/languages/cpp/std'
// Projection JSONs
import universalBlockProjections from '../../../src/blocks/projections/blocks/universal-blocks.json'
import { coreBlocks } from '../../../src/languages/cpp/core'

// Style presets
import apcsPreset from '../../../src/languages/cpp/styles/apcs.json'
import competitivePreset from '../../../src/languages/cpp/styles/competitive.json'
import googlePreset from '../../../src/languages/cpp/styles/google.json'

const STYLE_PRESETS: StylePreset[] = [
  apcsPreset as StylePreset,
  competitivePreset as StylePreset,
  googlePreset as StylePreset,
]

let blocklyPanel: BlocklyPanel | null = null
let blockSpecRegistry: BlockSpecRegistry | null = null
let blockRegistrar: BlockRegistrar | null = null
let levelSelector: LevelSelector | null = null
let styleSelector: StyleSelector | null = null
let _isUpdatingFromHost = false
let autoSync = true
let currentLevel: CognitiveLevel = 1
let currentIoPreference: 'iostream' | 'cstdio' = 'iostream'
let currentStyle: StylePreset = apcsPreset as StylePreset
let currentBlockStyleId: string = 'scratch'

function callBuildToolbox(level?: CognitiveLevel, ioPref?: 'iostream' | 'cstdio'): object {
  return buildToolbox({
    blockSpecRegistry: blockSpecRegistry!,
    level: level ?? currentLevel,
    ioPreference: ioPref ?? currentIoPreference,
    msgs: Blockly.Msg as Record<string, string>,
    categoryColors: CATEGORY_COLORS,
  })
}

function updateToolbox(): void {
  const ws = blocklyPanel?.getWorkspace()
  if (!ws) return
  const newToolbox = callBuildToolbox(currentLevel, currentIoPreference)
  ws.updateToolbox(newToolbox as any)
}

function updateStatusBar(): void {
  const statusBar = document.getElementById('status-bar')
  if (!statusBar) return
  const styleName = currentStyle.name['zh-TW'] || currentStyle.name['en'] || currentStyle.id
  const blockStyleLabel = (Blockly.Msg as Record<string, string>)[`BLOCK_STYLE_${currentBlockStyleId.toUpperCase()}`] || currentBlockStyleId
  statusBar.innerHTML = `<span>C++ | ${styleName} | ${blockStyleLabel} | L${currentLevel}</span>`
}

function init(): void {
  const container = document.getElementById('blockly-container')
  if (!container) {
    document.body.innerHTML = '<div style="color:red;padding:20px;">錯誤：找不到 Blockly 容器</div>'
    return
  }

  const mediaPath = (window as any).__blocklyMediaPath || './media/'

  try {
    // 1. Load block specs
    blockSpecRegistry = new BlockSpecRegistry()
    const allConcepts = [
      ...universalConcepts as unknown as ConceptDefJSON[],
      ...coreConcepts,
      ...allStdModules.flatMap(m => m.concepts),
    ]
    const allProjections = [
      ...universalBlockProjections as unknown as BlockProjectionJSON[],
      ...coreBlocks,
      ...allStdModules.flatMap(m => m.blocks),
    ]
    blockSpecRegistry.loadFromSplit(allConcepts, allProjections)

    // 2. Setup renderer & extractor
    const renderStrategyRegistry = new RenderStrategyRegistry()
    registerCppRenderStrategies(renderStrategyRegistry)
    const allSpecs = blockSpecRegistry.getAll()

    const patternRenderer = new PatternRenderer()
    patternRenderer.setRenderStrategyRegistry(renderStrategyRegistry)
    patternRenderer.loadBlockSpecs(allSpecs)
    setPatternRenderer(patternRenderer)

    const patternExtractor = new PatternExtractor()
    patternExtractor.loadBlockSpecs(allSpecs)

    // 3. Load i18n
    const localeLoader = new LocaleLoader()
    localeLoader.setBlocklyMsg(Blockly.Msg as Record<string, string>)
    localeLoader.loadFromData('zh-TW', zhTWBlocks, zhTWTypes)

    // 4. Register all blocks with Blockly
    blockRegistrar = new BlockRegistrar(blockSpecRegistry)

    // 5. Build toolbox & create BlocklyPanel
    const toolbox = callBuildToolbox()
    blocklyPanel = new VscodeBlocklyPanel({
      container,
      blockSpecRegistry,
      media: mediaPath,
    })
    blocklyPanel.init(toolbox)

    // Complete registration with workspace reference
    blockRegistrar.registerAll({
      getWorkspace: () => blocklyPanel?.getWorkspace() ?? null,
    })

    // Force Blockly to recalculate size after flex layout settles
    const wrapper = document.getElementById('blockly-wrapper') ?? container
    const doResize = () => {
      const ws = blocklyPanel?.getWorkspace()
      if (ws) Blockly.svgResize(ws)
    }
    requestAnimationFrame(doResize)
    new ResizeObserver(doResize).observe(wrapper)

    // 6. Setup toolbar controls
    setupToolbar()

    // 7. Listen for workspace changes
    blocklyPanel.onChange(() => {
      if (_isUpdatingFromHost) return
      sendBlocksUpdate()
      runBlockDiagnostics()
    })

    // 8. Listen for messages from Extension Host
    onMessage((message) => {
      switch (message.command) {
        case 'semantic:update':
          handleSemanticUpdate(message.data as { tree: SemanticNode; source: string })
          break
        case 'config:level':
          handleConfigLevel(message.data as { level: CognitiveLevel })
          break
        case 'config:style':
          handleConfigStyle(message.data as { style: StylePreset })
          break
        case 'document:switch':
          handleDocumentSwitch(message.data as { uri: string; tree?: SemanticNode })
          break
        case 'document:empty':
          handleDocumentEmpty()
          break
      }
    })

    // 9. Notify Extension Host
    send('webview:ready', {})
    updateStatusBar()
  } catch (err) {
    document.body.innerHTML = `<div style="color:red;padding:20px;">Blockly 初始化失敗：${err}</div>`
  }
}

function setupToolbar(): void {
  // Level selector
  const levelMount = document.getElementById('level-selector-mount')
  if (levelMount) {
    levelSelector = new LevelSelector(levelMount)
    levelSelector.setLevel(currentLevel)
    levelSelector.onChange((level) => {
      currentLevel = level
      updateToolbox()
      updateStatusBar()
      // Notify Extension Host so it persists the setting
      send('config:level:change', { level })
    })
  }

  // Style selector
  const styleMount = document.getElementById('style-selector-mount')
  if (styleMount) {
    styleSelector = new StyleSelector(styleMount, STYLE_PRESETS)
    styleSelector.onChange((style) => {
      currentStyle = style
      const ioPref = style.io_style === 'printf' ? 'cstdio' : 'iostream'
      if (ioPref !== currentIoPreference) {
        currentIoPreference = ioPref as 'iostream' | 'cstdio'
      }
      updateToolbox()
      updateStatusBar()
      // Notify Extension Host to update code generation style
      send('config:style:change', { styleId: style.id })
    })
  }

  // Block style selector
  const blockStyleMount = document.getElementById('block-style-selector-mount')
  if (blockStyleMount) {
    const blockStyleSelector = new BlockStyleSelector(blockStyleMount)
    blockStyleSelector.onChange((preset: BlockStylePreset) => {
      if (!blocklyPanel) return
      if (preset.renderer !== blocklyPanel.getRenderer()) {
        blocklyPanel.reinitWithPreset(callBuildToolbox(), preset)
        // Re-wire onChange since workspace was recreated
        blocklyPanel.onChange(() => {
          if (_isUpdatingFromHost) return
          sendBlocksUpdate()
          runBlockDiagnostics()
        })
      }
      currentBlockStyleId = preset.id
      updateStatusBar()
    })
  }

  // Auto sync toggle
  const autoSyncBtn = document.getElementById('auto-sync-btn')
  autoSyncBtn?.addEventListener('click', () => {
    autoSync = !autoSync
    autoSyncBtn.classList.toggle('auto-sync-on', autoSync)
    autoSyncBtn.classList.toggle('auto-sync-off', !autoSync)
    autoSyncBtn.title = autoSync ? '自動同步：開啟' : '自動同步：關閉'
  })

  // Sync buttons
  document.getElementById('sync-blocks-btn')?.addEventListener('click', () => {
    sendBlocksUpdate()
  })
  document.getElementById('sync-code-btn')?.addEventListener('click', () => {
    send('request:code-to-blocks', {})
  })

  // Undo / Redo / Clear
  document.getElementById('undo-btn')?.addEventListener('click', () => {
    blocklyPanel?.undo()
  })
  document.getElementById('redo-btn')?.addEventListener('click', () => {
    blocklyPanel?.redo()
  })
  document.getElementById('clear-btn')?.addEventListener('click', () => {
    blocklyPanel?.clear()
  })
}

function handleSemanticUpdate(data: { tree: SemanticNode; source: string }): void {
  if (!blocklyPanel || !data.tree) return

  const overlay = document.getElementById('empty-overlay')
  if (overlay) overlay.style.display = 'none'

  _isUpdatingFromHost = true
  try {
    const blocklyState = renderToBlocklyState(data.tree)
    blocklyPanel.setState(blocklyState)
    blocklyPanel.applyExtraStateVisuals()
  } finally {
    setTimeout(() => { _isUpdatingFromHost = false }, 50)
  }
}

function handleConfigLevel(data: { level: CognitiveLevel }): void {
  if (!blocklyPanel || !blockSpecRegistry) return
  currentLevel = data.level
  levelSelector?.setLevel(data.level)
  updateToolbox()
  updateStatusBar()
}

function handleConfigStyle(data: { style: StylePreset }): void {
  if (!blocklyPanel || !blockSpecRegistry) return
  currentStyle = data.style
  const ioPref = data.style.io_style === 'printf' ? 'cstdio' : 'iostream'
  if (ioPref !== currentIoPreference) {
    currentIoPreference = ioPref as 'iostream' | 'cstdio'
  }
  styleSelector?.setValue(data.style.id)
  updateToolbox()
  updateStatusBar()
}

function handleDocumentSwitch(data: { uri: string; tree?: SemanticNode }): void {
  if (data.tree) {
    handleSemanticUpdate({ tree: data.tree, source: 'code' })
  } else {
    clearWorkspace()
  }
}

function handleDocumentEmpty(): void {
  clearWorkspace()
  const overlay = document.getElementById('empty-overlay')
  if (overlay) overlay.style.display = 'flex'
}

function clearWorkspace(): void {
  if (!blocklyPanel) return
  _isUpdatingFromHost = true
  try {
    const ws = blocklyPanel.getWorkspace()
    ws?.clear()
  } finally {
    setTimeout(() => { _isUpdatingFromHost = false }, 50)
  }
}

function sendBlocksUpdate(): void {
  if (!blocklyPanel) return
  const blocklyState = blocklyPanel.getState()
  const semanticTree = blocklyPanel.extractSemanticTree()
  send('edit:blocks', { blocklyState, semanticTree })
}

function runBlockDiagnostics(): void {
  const workspace = blocklyPanel?.getWorkspace()
  if (!workspace) return
  const allBlocks = workspace.getAllBlocks(false)
  for (const block of allBlocks) block.setWarningText(null)
  const adapt = (block: Blockly.Block): DiagnosticBlock => ({
    id: block.id, type: block.type,
    getFieldValue: (n: string) => block.getFieldValue(n),
    getInputTargetBlock: (n: string) => {
      const t = block.getInputTargetBlock(n)
      return t ? { id: t.id, type: t.type, getFieldValue: (x: string) => t.getFieldValue(x), getInputTargetBlock: () => null, getInput: (x: string) => t.getInput(x) } : null
    },
    getInput: (n: string) => block.getInput(n),
  })
  for (const d of runDiagnostics(allBlocks.map(adapt))) {
    const block = workspace.getBlockById(d.blockId)
    if (block) block.setWarningText(Blockly.Msg[d.message] || d.message)
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
