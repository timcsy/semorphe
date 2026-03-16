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
import { cppDiagnosticRules } from '../languages/cpp/diagnostics'
import { registerCppLanguage } from '../languages/cpp/generators'
import { setDependencyResolver, setProgramScaffold, setScaffoldConfig } from '../core/projection/code-generator'
import { TopicRegistry } from '../core/topic-registry'
import { getVisibleConcepts, flattenLevelTree } from '../core/level-tree'
import type { Topic } from '../core/types'
import cppBeginnerTopic from '../languages/cpp/topics/cpp-beginner.json'
import cppCompetitiveTopic from '../languages/cpp/topics/cpp-competitive.json'
import { createPopulatedRegistry } from '../languages/cpp/std'
import { CppScaffold } from '../languages/cpp/cpp-scaffold'
import { cppStripScaffoldNodes } from '../languages/cpp/cpp-scaffold-filter'
import { createCppCodePatcher } from '../languages/cpp/auto-include'
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
import type { StyleSelector } from './toolbar/style-selector'
import type { TopicSelector } from './toolbar/topic-selector'
import type { StylePreset, ConceptDefJSON, BlockProjectionJSON } from '../core/types'
import { CATEGORY_COLORS } from './theme/category-colors'
import { buildToolbox } from './toolbox-builder'
import { cppCategoryDefs } from '../languages/cpp/toolbox-categories'
import { BlockRegistrar } from './block-registrar'
import { createAppLayout, setupSelectors, setupToolbarButtons, setupFileButtons, updateStatusBar } from './app-shell'
import type { AppShellElements } from './app-shell'
import { ExecutionController } from './execution-controller'
// Semantic layer
import universalConcepts from '../blocks/semantics/universal-concepts.json'
import { coreConcepts } from '../languages/cpp/core'
import { allStdModules } from '../languages/cpp/std'
// Projection layer
import universalBlockProjections from '../blocks/projections/blocks/universal-blocks.json'
import { coreBlocks } from '../languages/cpp/core'
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
  private topicRegistry: TopicRegistry
  private executionController: ExecutionController | null = null
  private blocksDirty = false
  private codeDirty = false
  private autoSync = true
  private codeToBlocksTimer: ReturnType<typeof setTimeout> | null = null
  private currentTopic: Topic
  private enabledBranches: Set<string>
  private currentIoPreference: 'iostream' | 'cstdio' = 'iostream'
  private _codeToBlocksInProgress = false
  private _restoringState = false
  private currentStylePreset: StylePreset = DEFAULT_STYLE
  private styleSelector: StyleSelector | null = null
  private topicSelector: TopicSelector | null = null
  private currentBlockStyleId: string = 'scratch'
  private currentLocale: string = 'zh-TW'
  private cppParser: CppParser | null = null
  private codeParserCache: { _lastTree: unknown } | null = null
  private patternRenderer: PatternRenderer | null = null
  private mobileMenu: import('./toolbar/mobile-menu').MobileMenu | null = null

  constructor() {
    this.bus = new SemanticBus()
    this.blockSpecRegistry = new BlockSpecRegistry()
    this.blockRegistrar = new BlockRegistrar(this.blockSpecRegistry)
    this.localeLoader = new LocaleLoader()
    this.storageService = new StorageService()
    this.topicRegistry = new TopicRegistry()

    // Register topics
    this.topicRegistry.register(cppBeginnerTopic as Topic)
    this.topicRegistry.register(cppCompetitiveTopic as Topic)

    // Default topic and branches (only root level enabled for simplest starting point)
    this.currentTopic = this.topicRegistry.getDefault('cpp')!
    this.enabledBranches = new Set([this.currentTopic.levelTree.id])
  }

  async init(): Promise<void> {
    // 1. Register C++ generators + dependency resolver + scaffold
    registerCppLanguage()
    const registry = createPopulatedRegistry()
    setDependencyResolver(registry)
    setProgramScaffold(new CppScaffold(registry))
    setScaffoldConfig({ scaffoldDepth: this.getScaffoldDepth() })
    this.localeLoader.setBlocklyMsg(Blockly.Msg as Record<string, string>)
    await this.localeLoader.load('zh-TW')

    // 2. Load block specs (split concept/projection architecture)
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
    this.blockSpecRegistry.loadFromSplit(allConcepts, allProjections)

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
    this.mobileMenu = elements.mobileMenu

    // 6. Create sync controller + wire scaffold + connect panels to bus
    this.syncController = new SyncController(this.bus, 'cpp', DEFAULT_STYLE)
    this.syncController.setProgramScaffold(new CppScaffold(registry))
    this.syncController.setScaffoldNodeFilter(cppStripScaffoldNodes)
    const cppPatcher = createCppCodePatcher(registry)
    this.syncController.setCodePatcher((code, tree) => cppPatcher(code, tree, this.currentStylePreset.namespace_style, this.getScaffoldDepth()))
    this.syncController.setTopic(this.currentTopic, this.enabledBranches)
    this.bus.on('semantic:update', (data) => {
      // Update Monaco: blocks→code and resync both produce code
      if ((data.source === 'blocks' || data.source === 'resync') && data.code !== undefined) {
        this.monacoPanel?.setCode(data.code)
        if (data.scaffoldResult) {
          this.monacoPanel?.applyScaffoldDecorations(data.code, data.scaffoldResult)
        }
      }
      // Update Blockly: code→blocks and resync both produce blockState
      if ((data.source === 'code' || data.source === 'resync') && data.blockState) {
        this.blocklyPanel?.onSemanticUpdate(data)
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
          this.syncBlocksToCodeWithMappings()
        },
      },
    )
    this.executionController.setupExecution()

    // 11. Setup toolbar + selectors
    setupToolbarButtons({
      onSyncBlocks: () => {
        this.syncBlocksToCodeWithMappings()
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
        this.updateToolbox()
        showToast(Blockly.Msg['TOAST_UPLOAD_SUCCESS'] || `Uploaded ${blocks.length} custom blocks`, 'success')
      },
    })

    const selectors = setupSelectors(STYLE_PRESETS, this.topicRegistry, this.currentTopic, this.enabledBranches, {
      onTopicChange: (topic, branches) => {
        const prevDepth = this.getScaffoldDepth()
        this.currentTopic = topic
        this.enabledBranches = branches
        const newDepth = this.getScaffoldDepth()
        setScaffoldConfig({ scaffoldDepth: newDepth })
        this.syncController?.setTopic(topic, branches)
        this.reloadBlockSpecsForTopic()
        this.updateToolbox()
        this.markOutOfScopeBlocks()
        if (!this._restoringState) {
          // Full resync only when scaffold depth crosses the 0 boundary
          // (blocks need scaffold wrapping/unwrapping). Otherwise just regen code.
          if ((prevDepth === 0) !== (newDepth === 0)) {
            this.resyncAfterTopicChange()
          } else {
            this.syncBlocksToCodeWithMappings()
          }
        }
        this.refreshStatusBar()
      },
      onBranchesChange: (branches) => {
        const prevDepth = this.getScaffoldDepth()
        this.enabledBranches = branches
        const newDepth = this.getScaffoldDepth()
        setScaffoldConfig({ scaffoldDepth: newDepth })
        this.syncController?.setBranches(branches)
        this.updateToolbox()
        this.markOutOfScopeBlocks()
        if (!this._restoringState) {
          if ((prevDepth === 0) !== (newDepth === 0)) {
            this.resyncAfterTopicChange()
          } else {
            this.syncBlocksToCodeWithMappings()
          }
        }
        this.refreshStatusBar()
      },
      onStyleChange: (style) => {
        this.syncController?.setStyle(style)
        this.syncController?.setCodingStyle(style)
        this.syncBlocksToCodeWithMappings()
        this.currentStylePreset = style
        this.refreshStatusBar()
        const ioPref = style.io_style === 'printf' ? 'cstdio' : 'iostream'
        if (ioPref !== this.currentIoPreference) {
          this.currentIoPreference = ioPref
          this.updateToolbox()
        }
      },
      onBlockStyleChange: (preset) => {
        if (!this.blocklyPanel) return
        if (preset.renderer !== this.blocklyPanel.getRenderer()) {
          this.blocklyPanel.reinitWithPreset(this.callBuildToolbox(), preset)
          this.wireBlocklyChangeHandler()
        }
        this.currentBlockStyleId = preset.id
        this.refreshStatusBar()
      },
      onLocaleChange: async (locale) => {
        await this.localeLoader.load(locale)
        this.currentLocale = locale
        this.updateToolbox()
        this.syncBlocksToCodeWithMappings()
        this.refreshStatusBar()
      },
    })
    this.styleSelector = selectors.styleSelector
    this.topicSelector = selectors.topicSelector

    // 12. Setup bidirectional highlighting
    this.setupBidirectionalHighlight()

    // 12b. Re-layout Monaco when code tab becomes visible (mobile)
    // Use double-rAF + setTimeout to ensure container is fully painted on real devices
    elements.mobileTabBar?.onTabChange((tab) => {
      if (tab === 'code') {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => this.monacoPanel?.relayout())
        })
        // Fallback for devices where rAF fires before paint
        setTimeout(() => this.monacoPanel?.relayout(), 100)
      }
    })

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
    pl.loadBlockSpecs(allSpecs, new Set(['call_expression', 'using_declaration', 'for_statement', 'assignment_expression', 'update_expression', 'switch_statement', 'case_statement', 'do_statement', 'conditional_expression', 'cast_expression', 'preproc_ifdef']))
    pl.loadLiftPatterns(liftPatternsJson as unknown as LiftPattern[])
    lifter.setPatternLifter(pl)
    const pr = new PatternRenderer()
    pr.setRenderStrategyRegistry(renderStrategyRegistry)
    pr.loadBlockSpecsWithTopic(allSpecs, this.currentTopic)
    setPatternRenderer(pr)
    this.patternRenderer = pr
    registerCppLifters(lifter, { transformRegistry, liftStrategyRegistry, renderStrategyRegistry })
    const parser = new CppParser()
    await parser.init()
    this.cppParser = parser
    const codeParser = { _lastTree: null as unknown, parse(_code: string) { return { rootNode: this._lastTree } } }
    this.codeParserCache = codeParser
    this.syncController!.setCodeToBlocksPipeline(lifter, codeParser)
    const originalSync = this.syncController!.syncCodeToBlocks.bind(this.syncController!)
    const monacoPanel = this.monacoPanel!

    this.syncController!.syncCodeToBlocks = (codeArg?: string) => {
      const code = codeArg ?? monacoPanel.getCode()
      this._codeToBlocksInProgress = true
      parser.parse(code).then(tree => {
        codeParser._lastTree = tree.rootNode
        originalSync(code)
        const patched = this.syncController?.patchMissingDependencies(code)
        if (patched) {
          const linesDelta = patched.split('\n').length - code.split('\n').length
          this.monacoPanel?.setCodePreserveCursor(patched, linesDelta)
        }
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
      const monacoEl = document.getElementById('monaco-panel')
      showToast(
        Blockly.Msg['TOAST_ERROR'] || `⚠ ${errors.length} 個語法錯誤`,
        'error',
        monacoEl ?? undefined,
      )
    })
    this.syncController!.setCodingStyle(this.currentStylePreset)
    this.syncController!.onIoConformance((result) => {
      const curIo = this.currentStylePreset.io_style === 'printf' ? 'printf/scanf' : 'cout/cin'
      const altIo = this.currentStylePreset.io_style === 'printf' ? 'cout/cin' : 'printf/scanf'
      if (result.verdict === 'bulk_deviation') {
        const other = STYLE_PRESETS.find(p => p.io_style !== this.currentStylePreset.io_style)
        if (!other) return
        showStyleActionBar(`程式碼大量使用 ${altIo}，但目前風格為 ${curIo}`, [
          { label: `切換到「${other.name['zh-TW'] || other.id}」`, primary: true, action: () => this.applyStylePreset(other) },
          { label: '保持目前風格', action: () => {} },
        ])
      } else if (result.verdict === 'minor_exception') {
        showStyleActionBar(`偵測到少數 ${altIo} 用法（目前風格為 ${curIo}）`, [
          { label: '保留（刻意使用）', action: () => {} },
          { label: `統一為 ${curIo}`, primary: true, action: () => {
            this.syncBlocksToCodeWithMappings()
          }},
        ])
      }
    })
    this.syncController!.onStyleExceptions((exceptions, apply) => {
      showStyleActionBar(`積木風格不符：${exceptions.map(e => `${e.label} → ${e.suggestion}`).join('、')}`, [
        { label: '自動轉換', primary: true, action: () => { apply(); this.syncBlocksToCodeWithMappings() }},
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
    if (ioPref !== this.currentIoPreference) { this.currentIoPreference = ioPref; this.updateToolbox() }
    this.syncBlocksToCodeWithMappings()
  }

  private getVisibleConcepts(): Set<string> {
    return getVisibleConcepts(this.currentTopic, this.enabledBranches)
  }

  private getScaffoldDepth(): number {
    const allNodes = flattenLevelTree(this.currentTopic.levelTree)
    let maxLevel = 0
    for (const node of allNodes) {
      if (this.enabledBranches.has(node.id)) {
        maxLevel = Math.max(maxLevel, node.level)
      }
    }
    return maxLevel
  }

  private markOutOfScopeBlocks(): void {
    this.blocklyPanel?.markOutOfScopeBlocks(this.getVisibleConcepts())
  }

  private reloadBlockSpecsForTopic(): void {
    if (!this.patternRenderer) return
    const allSpecs = this.blockSpecRegistry.getAll()
    this.patternRenderer.loadBlockSpecsWithTopic(allSpecs, this.currentTopic)
  }

  private callBuildToolbox(): object {
    return buildToolbox({
      blockSpecRegistry: this.blockSpecRegistry,
      visibleConcepts: this.getVisibleConcepts(),
      ioPreference: this.currentIoPreference,
      msgs: Blockly.Msg as Record<string, string>,
      categoryColors: CATEGORY_COLORS,
      categoryDefs: cppCategoryDefs,
    })
  }

  /** Resync blocks/code after topic/branch change; async-parses if needed for depth 0→1+ */
  private resyncAfterTopicChange(): void {
    const tree = this.blocklyPanel?.extractSemanticTree()
    if (!tree) return
    const code = this.monacoPanel?.getCode() ?? ''
    const depth = this.getScaffoldDepth()
    const needsRelift = depth > 0 && !(tree.children.body ?? []).some(
      (n: { concept: string; properties: Record<string, unknown> }) =>
        n.concept === 'func_def' && n.properties.name === 'main'
    )
    if (needsRelift && this.cppParser && code.trim()) {
      this.cppParser.parse(code).then(parsed => {
        if (this.codeParserCache) this.codeParserCache._lastTree = parsed.rootNode
        this.syncController?.resyncForTopic(tree, code)
      }).catch(() => this.syncController?.resyncForTopic(tree, code))
    } else {
      this.syncController?.resyncForTopic(tree, code)
    }
  }

  /** Extract tree + blockMappings and sync to code */
  private syncBlocksToCodeWithMappings(): void {
    const tree = this.blocklyPanel?.extractSemanticTree()
    const blockMappings = this.blocklyPanel?.getBlockMappings()
    this.syncController?.syncBlocksToCode(tree, blockMappings)
  }

  private updateToolbox(): void {
    const ws = this.blocklyPanel?.getWorkspace()
    if (!ws) return
    ws.updateToolbox(this.callBuildToolbox() as Blockly.utils.toolbox.ToolboxDefinition)
  }

  private wireBlocklyChangeHandler(): void {
    this.blocklyPanel?.onChange(() => {
      if (this._codeToBlocksInProgress) return
      this.blocksDirty = true; this.updateSyncHints()
      if (this.autoSync) {
        const tree = this.blocklyPanel?.extractSemanticTree()
        const blockMappings = this.blocklyPanel?.getBlockMappings()
        this.syncController!.syncBlocksToCode(tree, blockMappings)
        this.blocksDirty = false; this.updateSyncHints()
      }
      this.runBlockDiagnostics(); this.autoSave()
    })
  }

  private refreshStatusBar(): void {
    updateStatusBar(this.currentStylePreset, this.currentLocale, this.currentBlockStyleId, this.currentTopic.name, this.mobileMenu)
  }

  private setupBidirectionalHighlight(): void {
    this.blocklyPanel?.onBlockSelect((blockId) => {
      this.monacoPanel?.clearHighlight(); this.blocklyPanel?.clearHighlight()
      if (!blockId) return
      this.blocklyPanel?.highlightBlock(blockId, 'block-to-code')
      const m = this.syncController?.getMappingForBlock(blockId)
      if (m) this.monacoPanel?.addHighlight(m.startLine + 1, m.endLine + 1, 'block-to-code')
    })
    this.monacoPanel?.onCursorChange((line) => {
      this.blocklyPanel?.clearHighlight(); this.monacoPanel?.clearHighlight(); this.monacoPanel?.dismissPendingHighlight()
      try { if (Blockly.getSelected()) Blockly.common.setSelected(null as unknown as Blockly.ISelectable) } catch { /* ignore */ }
      const m = this.syncController?.getMappingForLine(line - 1)
      if (!m) return
      if (m.blockId) this.blocklyPanel?.highlightBlock(m.blockId, 'code-to-block')
      this.monacoPanel?.addHighlight(m.startLine + 1, m.endLine + 1, 'code-to-block')
    })
  }

  private buildSaveState(): SavedState {
    return { version: 1, tree: this.syncController?.getCurrentTree() ?? null,
      blocklyState: this.blocklyPanel?.getState() ?? {}, code: this.monacoPanel?.getCode() ?? '',
      language: 'cpp', styleId: this.currentStylePreset.id,
      topicId: this.currentTopic.id, enabledBranches: [...this.enabledBranches],
      lastModified: new Date().toISOString(), blockStyleId: this.currentBlockStyleId, locale: this.currentLocale }
  }

  private autoSave(): void {
    this.storageService.save(this.buildSaveState())
  }

  private restoreState(): void {
    const state = this.storageService.load()
    if (!state) return

    // 1. Restore blocks FIRST (before level change triggers resync)
    if (state.blocklyState && Object.keys(state.blocklyState).length > 0) {
      this.blocklyPanel?.setState(state.blocklyState)
    }

    // 2. Restore topic and branches WITHOUT triggering resyncAfterTopicChange
    this._restoringState = true
    if (state.topicId) {
      const topic = this.topicRegistry.get(state.topicId)
      if (topic) {
        this.currentTopic = topic
        this.enabledBranches = state.enabledBranches
          ? new Set(state.enabledBranches)
          : new Set([topic.levelTree.id])
      }
    }
    setScaffoldConfig({ scaffoldDepth: this.getScaffoldDepth() })
    this.syncController?.setTopic(this.currentTopic, this.enabledBranches)
    this.topicSelector?.setTopic(this.currentTopic, this.enabledBranches)
    this.updateToolbox()
    this._restoringState = false

    // 3. Generate code from restored blocks, then resync for the restored topic
    this.syncBlocksToCodeWithMappings()
    this.resyncAfterTopicChange()
  }

  private updateSyncHints(): void {
    document.getElementById('sync-blocks-btn')?.classList.toggle('sync-hint', this.blocksDirty)
    document.getElementById('sync-code-btn')?.classList.toggle('sync-hint', this.codeDirty)
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
    for (const id of ['auto-sync-btn', 'mobile-sync-btn']) {
      const btn = document.getElementById(id)
      if (btn) {
        btn.classList.toggle('auto-sync-on', this.autoSync)
        btn.classList.toggle('auto-sync-off', !this.autoSync)
        btn.title = this.autoSync ? '自動同步：開啟' : '自動同步：關閉'
      }
    }
    if (!this.autoSync) return
    if (this.blocksDirty) {
      this.syncBlocksToCodeWithMappings()
      this.blocksDirty = false; this.updateSyncHints()
    }
    if (this.codeDirty) this.syncController?.syncCodeToBlocks(this.monacoPanel?.getCode())
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
    for (const d of runDiagnostics(allBlocks.map(adapt), cppDiagnosticRules)) {
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
