import * as Blockly from 'blockly'
import type { BlocklyPanel } from './panels/blockly-panel'
import type { MonacoPanel } from './panels/monaco-panel'
import { SyncController } from './sync-controller'
import type { SyncError } from './sync-controller'
import { SemanticBus } from '../core/semantic-bus'
import { showToast } from './toolbar/toast'
import { showStyleActionBar } from './toolbar/style-action-bar'
import { runDiagnostics } from '../core/diagnostics'
import type { DiagnosticBlock } from '../core/diagnostics'
import { registerCppLanguage } from '../languages/cpp/generators'
import { registerCppLifters } from '../languages/cpp/lifters'
import { Lifter } from '../core/lift/lifter'
import { PatternLifter } from '../core/lift/pattern-lifter'
import { PatternRenderer } from '../core/projection/pattern-renderer'
import { setPatternRenderer } from '../core/projection/block-renderer'
import { TransformRegistry, registerCoreTransforms, LiftStrategyRegistry, RenderStrategyRegistry } from '../core/registry'
import { CppParser } from '../languages/cpp/parser'
import liftPatternsJson from '../languages/cpp/lift-patterns.json'
import type { LiftPattern } from '../core/types'
import { BlockSpecRegistry } from '../core/block-spec-registry'
import { StorageService } from '../core/storage'
import type { SavedState } from '../core/storage'
import { LocaleLoader } from '../i18n/loader'
import type { LevelSelector } from './toolbar/level-selector'
import type { StyleSelector } from './toolbar/style-selector'
import type { StylePreset, BlockSpec, CognitiveLevel, ConceptDefJSON, BlockProjectionJSON } from '../core/types'
import { CATEGORY_COLORS } from './theme/category-colors'
import { buildToolbox } from './toolbox-builder'
import { BlockRegistrar } from './block-registrar'
import { createAppLayout, setupSelectors, setupToolbarButtons, setupFileButtons, updateStatusBar } from './app-shell'
import type { AppShellElements } from './app-shell'
import { ExecutionController } from './execution-controller'
import { mergeToBlockSpecs } from '../core/block-spec-adapter'
// Semantic layer: concept definitions
import universalConcepts from '../blocks/semantics/universal-concepts.json'
import cppConcepts from '../languages/cpp/semantics/concepts.json'
// Projection layer: block definitions
import universalBlockProjections from '../blocks/projections/blocks/universal-blocks.json'
import cppBasicProjections from '../languages/cpp/projections/blocks/basic.json'
import cppSpecialProjections from '../languages/cpp/projections/blocks/special.json'
import cppAdvancedProjections from '../languages/cpp/projections/blocks/advanced.json'
// Stdlib (still in old format for now)
import cppStdlibContainers from '../languages/cpp/blocks/stdlib/containers.json'
import cppStdlibAlgorithms from '../languages/cpp/blocks/stdlib/algorithms.json'
import apcsPreset from '../languages/cpp/styles/apcs.json'
import competitivePreset from '../languages/cpp/styles/competitive.json'
import googlePreset from '../languages/cpp/styles/google.json'

const STYLE_PRESETS: StylePreset[] = [
  apcsPreset as StylePreset,
  competitivePreset as StylePreset,
  googlePreset as StylePreset,
]

const DEFAULT_STYLE: StylePreset = STYLE_PRESETS[0]

export class App {
  private bus: SemanticBus
  private blocklyPanel: BlocklyPanel | null = null
  private monacoPanel: MonacoPanel | null = null
  private syncController: SyncController | null = null
  private blockSpecRegistry: BlockSpecRegistry
  private blockRegistrar: BlockRegistrar
  private localeLoader: LocaleLoader
  private storageService: StorageService
  private levelSelector: LevelSelector | null = null
  private executionController: ExecutionController | null = null
  private blocksDirty = false
  private codeDirty = false
  private autoSync = true
  private codeToBlocksTimer: ReturnType<typeof setTimeout> | null = null
  private currentLevel: CognitiveLevel = 1
  private currentIoPreference: 'iostream' | 'cstdio' = 'iostream'
  private _codeToBlocksInProgress = false
  private currentStylePreset: StylePreset = DEFAULT_STYLE
  private styleSelector: StyleSelector | null = null
  private currentBlockStyleId: string = 'scratch'
  private currentLocale: string = 'zh-TW'

  constructor() {
    this.bus = new SemanticBus()
    this.blockSpecRegistry = new BlockSpecRegistry()
    this.blockRegistrar = new BlockRegistrar(this.blockSpecRegistry)
    this.localeLoader = new LocaleLoader()
    this.storageService = new StorageService()
  }

  async init(): Promise<void> {
    // 1. Register C++ code generators
    registerCppLanguage()

    // 2. Load locale
    this.localeLoader.setBlocklyMsg(Blockly.Msg as Record<string, string>)
    await this.localeLoader.load('zh-TW')

    // 3. Load block specs (split concept/projection architecture)
    const allConcepts = [...universalConcepts as unknown as ConceptDefJSON[], ...cppConcepts as unknown as ConceptDefJSON[]]
    const allProjections = [
      ...universalBlockProjections as unknown as BlockProjectionJSON[], ...cppBasicProjections as unknown as BlockProjectionJSON[],
      ...cppSpecialProjections as unknown as BlockProjectionJSON[], ...cppAdvancedProjections as unknown as BlockProjectionJSON[],
    ]
    this.blockSpecRegistry.loadFromJSON(mergeToBlockSpecs(allConcepts, allProjections))
    this.blockSpecRegistry.loadFromJSON(cppStdlibContainers as unknown as BlockSpec[])
    this.blockSpecRegistry.loadFromJSON(cppStdlibAlgorithms as unknown as BlockSpec[])

    // 4. Register all blocks with Blockly
    this.blockRegistrar.registerAll({
      getWorkspace: () => this.blocklyPanel?.getWorkspace() ?? null,
    })

    // 5. Build UI layout
    const appEl = document.getElementById('app')
    if (!appEl) throw new Error('#app element not found')

    const elements: AppShellElements = createAppLayout(appEl, this.blockSpecRegistry, this.callBuildToolbox())
    this.blocklyPanel = elements.blocklyPanel
    this.monacoPanel = elements.monacoPanel

    elements.quickAccessBar.onBlockCreate((blockType) => {
      const workspace = this.blocklyPanel?.getWorkspace()
      if (!workspace) return
      const block = workspace.newBlock(blockType)
      block.initSvg()
      block.render()
      const metrics = workspace.getMetrics()
      if (metrics) {
        block.moveBy(metrics.viewWidth / 2 - 50, metrics.viewHeight / 2 - 30)
      }
    })

    // 6. Create sync controller
    this.syncController = new SyncController(this.bus, 'cpp', DEFAULT_STYLE)

    // 7. Connect panels to bus
    this.bus.on('semantic:update', (data) => {
      if (data.source === 'blocks' && data.code !== undefined) {
        this.monacoPanel?.setCode(data.code)
      }
      if (data.source === 'code' && data.blockState) {
        this.blocklyPanel?.setState(data.blockState as object)
      }
    })

    // 8. Setup code→blocks pipeline
    await this.setupCodeToBlocksPipeline()

    // 9. Wire panel change events
    this.wireBlocklyChangeHandler()
    this.monacoPanel.onChange(() => {
      if (this._codeToBlocksInProgress) return
      this.codeDirty = true
      this.updateSyncHints()
      if (this.autoSync) this.scheduleCodeToBlocksSync()
    })

    // 10. Setup execution controller
    this.executionController = new ExecutionController(
      {
        blocklyPanel: this.blocklyPanel,
        monacoPanel: this.monacoPanel,
        consolePanel: elements.consolePanel,
        variablePanel: elements.variablePanel,
        bottomPanel: elements.bottomPanel,
        syncController: this.syncController,
      },
      {
        getBlocksDirty: () => this.blocksDirty,
        syncBeforeRun: () => {
          this.syncController?.syncBlocksToCode(this.blocklyPanel?.extractSemanticTree() ?? undefined)
        },
      },
    )
    this.executionController.setupExecution()

    // 11. Setup toolbar + selectors
    setupToolbarButtons({
      onSyncBlocks: () => {
        this.syncController?.syncBlocksToCode(this.blocklyPanel?.extractSemanticTree() ?? undefined)
        this.blocksDirty = false
        this.updateSyncHints()
      },
      onSyncCode: () => {
        this.syncController?.syncCodeToBlocks(this.monacoPanel?.getCode())
      },
      onToggleAutoSync: () => this.toggleAutoSync(),
      onUndo: () => this.blocklyPanel?.undo(),
      onRedo: () => this.blocklyPanel?.redo(),
      onClear: () => this.blocklyPanel?.clear(),
    })

    setupFileButtons(this.storageService, {
      getExportState: () => this.buildSaveState(),
      importState: (state: SavedState) => {
        if (state.blocklyState && Object.keys(state.blocklyState).length > 0) this.blocklyPanel?.setState(state.blocklyState)
        if (state.code) this.monacoPanel?.setCode(state.code)
      },
      onUploadCustomBlocks: (blocks: object[]) => {
        for (const blockDef of blocks) Blockly.common.defineBlocksWithJsonArray([blockDef])
        this.updateToolboxForLevel(this.currentLevel)
        showToast(Blockly.Msg['TOAST_UPLOAD_SUCCESS'] || `Uploaded ${blocks.length} custom blocks`, 'success')
      },
    })

    const selectors = setupSelectors(STYLE_PRESETS, this.currentLevel, {
      onLevelChange: (level) => {
        this.currentLevel = level
        this.updateToolboxForLevel(level)
        elements.quickAccessBar.setLevel(level)
        this.refreshStatusBar()
      },
      onStyleChange: (style) => {
        this.syncController?.setStyle(style)
        this.syncController?.setCodingStyle(style)
        this.syncController?.syncBlocksToCode(this.blocklyPanel?.extractSemanticTree() ?? undefined)
        this.currentStylePreset = style
        this.refreshStatusBar()
        const ioPref = style.io_style === 'printf' ? 'cstdio' : 'iostream'
        if (ioPref !== this.currentIoPreference) {
          this.currentIoPreference = ioPref
          this.updateToolboxForLevel(this.currentLevel)
        }
      },
      onBlockStyleChange: (preset) => {
        if (!this.blocklyPanel) return
        if (preset.renderer !== this.blocklyPanel.getRenderer()) {
          this.blocklyPanel.reinitWithPreset(this.callBuildToolbox(this.currentLevel, this.currentIoPreference), preset)
          this.wireBlocklyChangeHandler()
        }
        this.currentBlockStyleId = preset.id
        this.refreshStatusBar()
      },
      onLocaleChange: async (locale) => {
        await this.localeLoader.load(locale)
        this.currentLocale = locale
        this.updateToolboxForLevel(this.currentLevel)
        this.syncController?.syncBlocksToCode(this.blocklyPanel?.extractSemanticTree() ?? undefined)
        this.refreshStatusBar()
      },
    })
    this.levelSelector = selectors.levelSelector
    this.styleSelector = selectors.styleSelector

    // 12. Setup bidirectional highlighting
    this.setupBidirectionalHighlight()

    // 13. Update status bar + restore state
    this.refreshStatusBar()
    this.restoreState()
  }

  private async setupCodeToBlocksPipeline(): Promise<void> {
    const lifter = new Lifter()
    const transformRegistry = new TransformRegistry()
    registerCoreTransforms(transformRegistry)
    const liftStrategyRegistry = new LiftStrategyRegistry()
    const renderStrategyRegistry = new RenderStrategyRegistry()
    const allSpecs = this.blockSpecRegistry.getAll()
    const pl = new PatternLifter()
    pl.setTransformRegistry(transformRegistry)
    pl.setLiftStrategyRegistry(liftStrategyRegistry)
    pl.loadBlockSpecs(allSpecs, new Set(['call_expression', 'using_declaration', 'for_statement', 'assignment_expression', 'update_expression', 'switch_statement', 'case_statement', 'do_statement', 'conditional_expression', 'cast_expression']))
    pl.loadLiftPatterns(liftPatternsJson as unknown as LiftPattern[])
    lifter.setPatternLifter(pl)
    const pr = new PatternRenderer()
    pr.setRenderStrategyRegistry(renderStrategyRegistry)
    pr.loadBlockSpecs(allSpecs)
    setPatternRenderer(pr)
    registerCppLifters(lifter, { transformRegistry, liftStrategyRegistry, renderStrategyRegistry })
    const parser = new CppParser()
    await parser.init()
    const codeParser = { _lastTree: null as unknown, parse(_code: string) { return { rootNode: this._lastTree } } }
    this.syncController!.setCodeToBlocksPipeline(lifter, codeParser)
    const originalSync = this.syncController!.syncCodeToBlocks.bind(this.syncController!)
    const monacoPanel = this.monacoPanel!

    this.syncController!.syncCodeToBlocks = (codeArg?: string) => {
      const code = codeArg ?? monacoPanel.getCode()
      this._codeToBlocksInProgress = true
      parser.parse(code).then(tree => {
        codeParser._lastTree = tree.rootNode
        originalSync(code)
        this.codeDirty = false
        this.blocksDirty = false
        this.updateSyncHints()
        setTimeout(() => { this._codeToBlocksInProgress = false }, 300)
      }).catch(err => {
        console.error('Parse error:', err)
        this._codeToBlocksInProgress = false
      })
      return false
    }

    this.syncController!.onError((errors: SyncError[]) => {
      console.warn('Sync errors:', errors.map(e => e.message).join('\n'))
      showToast(Blockly.Msg['TOAST_ERROR'] || `⚠ ${errors.length} 個語法錯誤`, 'error')
    })
    this.syncController!.setCodingStyle(this.currentStylePreset)
    this.syncController!.onIoConformance((result) => {
      const currentIo = this.currentStylePreset.io_style === 'printf' ? 'printf/scanf' : 'cout/cin'
      const otherIo = this.currentStylePreset.io_style === 'printf' ? 'cout/cin' : 'printf/scanf'

      if (result.verdict === 'bulk_deviation') {
        const other = STYLE_PRESETS.find(p => p.io_style !== this.currentStylePreset.io_style)
        if (!other) return
        showStyleActionBar(`程式碼大量使用 ${otherIo}，但目前風格為 ${currentIo}`, [
          { label: `切換到「${other.name['zh-TW'] || other.id}」`, primary: true, action: () => {
            this.applyStylePreset(other)
          }},
          { label: '保持目前風格', action: () => {} },
        ])
      } else if (result.verdict === 'minor_exception') {
        showStyleActionBar(`偵測到少數 ${otherIo} 用法（目前風格為 ${currentIo}）`, [
          { label: '保留（刻意使用）', action: () => {} },
          { label: `統一為 ${currentIo}`, primary: true, action: () => {
            this.syncController?.syncBlocksToCode(this.blocklyPanel?.extractSemanticTree() ?? undefined)
          }},
        ])
      }
    })
    this.syncController!.onStyleExceptions((exceptions, apply) => {
      showStyleActionBar(`積木風格不符：${exceptions.map(e => `${e.label} → ${e.suggestion}`).join('、')}`, [
        { label: '自動轉換', primary: true, action: () => { apply(); this.syncController?.syncBlocksToCode(this.blocklyPanel?.extractSemanticTree() ?? undefined) }},
        { label: '保留', action: () => {} },
      ])
    })
  }

  private applyStylePreset(preset: StylePreset): void {
    this.currentStylePreset = preset
    this.syncController?.setStyle(preset)
    this.syncController?.setCodingStyle(preset)
    this.styleSelector?.setValue(preset.id)
    this.refreshStatusBar()
    const ioPref = preset.io_style === 'printf' ? 'cstdio' : 'iostream'
    if (ioPref !== this.currentIoPreference) { this.currentIoPreference = ioPref; this.updateToolboxForLevel(this.currentLevel) }
    this.syncController?.syncBlocksToCode(this.blocklyPanel?.extractSemanticTree() ?? undefined)
  }

  private callBuildToolbox(level?: CognitiveLevel, ioPreference?: 'iostream' | 'cstdio'): object {
    return buildToolbox({
      blockSpecRegistry: this.blockSpecRegistry,
      level: level ?? this.currentLevel,
      ioPreference: ioPreference ?? this.currentIoPreference,
      msgs: Blockly.Msg as Record<string, string>,
      categoryColors: CATEGORY_COLORS,
    })
  }

  private updateToolboxForLevel(level: CognitiveLevel): void {
    if (!this.blocklyPanel) return
    const workspace = this.blocklyPanel.getWorkspace()
    if (!workspace) return
    const toolbox = this.callBuildToolbox(level, this.currentIoPreference)
    workspace.updateToolbox(toolbox as Blockly.utils.toolbox.ToolboxDefinition)
  }

  private wireBlocklyChangeHandler(): void {
    this.blocklyPanel?.onChange(() => {
      if (this._codeToBlocksInProgress) return
      this.blocksDirty = true
      this.updateSyncHints()
      if (this.autoSync) {
        this.syncController!.syncBlocksToCode(this.blocklyPanel?.extractSemanticTree())
        this.blocksDirty = false
        this.updateSyncHints()
      }
      this.runBlockDiagnostics()
      this.autoSave()
    })
  }

  private refreshStatusBar(): void {
    updateStatusBar(this.currentStylePreset, this.currentLocale, this.currentBlockStyleId, this.currentLevel)
  }

  private setupBidirectionalHighlight(): void {
    this.blocklyPanel?.onBlockSelect((blockId) => {
      this.monacoPanel?.clearHighlight()
      this.blocklyPanel?.clearHighlight()
      if (!blockId) return
      this.blocklyPanel?.highlightBlock(blockId, 'block-to-code')
      const m = this.syncController?.getMappingForBlock(blockId)
      if (m) this.monacoPanel?.addHighlight(m.startLine + 1, m.endLine + 1, 'block-to-code')
    })
    this.monacoPanel?.onCursorChange((line) => {
      this.blocklyPanel?.clearHighlight()
      this.monacoPanel?.clearHighlight()
      try { if (Blockly.getSelected()) Blockly.common.setSelected(null as unknown as Blockly.ISelectable) } catch { /* ignore */ }
      const m = this.syncController?.getMappingForLine(line - 1)
      if (m) {
        this.blocklyPanel?.highlightBlock(m.blockId, 'code-to-block')
        this.monacoPanel?.addHighlight(m.startLine + 1, m.endLine + 1, 'code-to-block')
      }
    })
  }

  private buildSaveState(): SavedState {
    return {
      version: 1,
      tree: this.syncController?.getCurrentTree() ?? null,
      blocklyState: this.blocklyPanel?.getState() ?? {},
      code: this.monacoPanel?.getCode() ?? '',
      language: 'cpp',
      styleId: this.currentStylePreset.id,
      level: this.currentLevel,
      lastModified: new Date().toISOString(),
      blockStyleId: this.currentBlockStyleId,
      locale: this.currentLocale,
    }
  }

  private autoSave(): void {
    this.storageService.save(this.buildSaveState())
  }

  private restoreState(): void {
    const state = this.storageService.load()
    if (!state) return
    if (state.blocklyState && Object.keys(state.blocklyState).length > 0) {
      this.blocklyPanel?.setState(state.blocklyState)
    }
    if (state.code) {
      this.monacoPanel?.setCode(state.code)
    }
    if (state.level !== undefined) {
      this.currentLevel = state.level as CognitiveLevel
      this.levelSelector?.setLevel(this.currentLevel)
      this.updateToolboxForLevel(this.currentLevel)
    }
  }

  private updateSyncHints(): void {
    const syncBlocksBtn = document.getElementById('sync-blocks-btn')
    const syncCodeBtn = document.getElementById('sync-code-btn')
    if (syncBlocksBtn) {
      syncBlocksBtn.classList.toggle('sync-hint', this.blocksDirty)
    }
    if (syncCodeBtn) {
      syncCodeBtn.classList.toggle('sync-hint', this.codeDirty)
    }
  }

  private scheduleCodeToBlocksSync(): void {
    if (this.codeToBlocksTimer) clearTimeout(this.codeToBlocksTimer)
    this.codeToBlocksTimer = setTimeout(() => {
      this.codeToBlocksTimer = null
      this.syncController?.syncCodeToBlocks(this.monacoPanel?.getCode())
    }, 800)
  }

  private toggleAutoSync(): void {
    this.autoSync = !this.autoSync
    const btn = document.getElementById('auto-sync-btn')
    if (btn) {
      btn.classList.toggle('auto-sync-on', this.autoSync)
      btn.classList.toggle('auto-sync-off', !this.autoSync)
      btn.title = this.autoSync ? '自動同步：開啟' : '自動同步：關閉'
    }
    if (this.autoSync) {
      if (this.blocksDirty) {
        this.syncController?.syncBlocksToCode(this.blocklyPanel?.extractSemanticTree() ?? undefined)
        this.blocksDirty = false
        this.updateSyncHints()
      }
      if (this.codeDirty) {
        this.syncController?.syncCodeToBlocks(this.monacoPanel?.getCode())
      }
    }
  }

  private runBlockDiagnostics(): void {
    const workspace = this.blocklyPanel?.getWorkspace()
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

  dispose(): void {
    this.blocklyPanel?.dispose()
    this.monacoPanel?.dispose()
    this.executionController?.dispose()
  }
}
