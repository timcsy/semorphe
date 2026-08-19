import * as Blockly from 'blockly'
import type { BlocklyPanel } from './panels/blockly-panel'
import type { CodeView } from '../core/host/code-view'
import type { HostProfile } from '../core/host/host-profile'
import { SyncController } from './sync-controller'
import type { SyncError } from './sync-controller'
import { SemanticBus } from '../core/semantic-bus'
import { showToast } from './toolbar/toast'
import { showStyleActionBar } from './toolbar/style-action-bar'
import { runDiagnostics, diagnosticsFromTree } from '../core/diagnostics'
import type { SemanticNode } from '../core/types'
import type { DiagnosticBlock } from '../core/diagnostics'
import { cppDiagnosticRules } from '../languages/cpp/diagnostics'
import { registerCppLanguage } from '../languages/cpp/generators'
import { setDependencyResolver, setProgramScaffold, setScaffoldConfig } from '../core/projection/code-generator'
import { TopicRegistry } from '../core/topic-registry'
import { TargetRegistry } from '../core/target-registry'
import { filterByTarget } from '../core/component/traits'
import { getVisibleConcepts, flattenLevelTree } from '../core/level-tree'
import type { Target, Topic } from '../core/types'
import cppBeginnerTopic from '../languages/cpp/topics/cpp-beginner.json'
import cppCompetitiveTopic from '../languages/cpp/topics/cpp-competitive.json'
import cBeginnerTopic from '../languages/cpp/topics/c-beginner.json'
import arduinoTopic from '../languages/cpp/topics/arduino.json'
import cppTargetDef from '../languages/cpp/targets/cpp.json'
import cTargetDef from '../languages/cpp/targets/c.json'
import cppCompetitiveTargetDef from '../languages/cpp/targets/cpp-competitive.json'
import arduinoTargetDef from '../languages/cpp/targets/arduino.json'
// spec 142：三塊板子。⚠️ 它們**共用** `arduino` 課程清單，差別只在 `provides`
//（不新增三份幾乎相同的 topic JSON——見 specs/142 的 research.md R1）。
import arduinoUnoTargetDef from '../languages/cpp/targets/arduino-uno.json'
import arduinoNanoTargetDef from '../languages/cpp/targets/arduino-nano.json'
import esp32TargetDef from '../languages/cpp/targets/esp32.json'
import { createPopulatedRegistry } from '../languages/cpp/std'
import { CppScaffold } from '../languages/cpp/cpp-scaffold'
import { cppStripScaffoldNodes } from '../languages/cpp/cpp-scaffold-filter'
import { createCppCodePatcher, computeAutoIncludes, autoIncludeNodes } from '../languages/cpp/auto-include'
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

import type { SavedState } from '../core/storage'
import { describeRefusal } from './refusal-message'
import { LocaleLoader } from '../i18n/loader'
import type { StyleSelector } from './toolbar/style-selector'
import type { TopicSelector } from './toolbar/topic-selector'
import type { StylePreset } from '../core/types'
import { CATEGORY_COLORS } from './theme/category-colors'
import { registerViewsIn, connectViews } from '../core/view-registry'
import { buildToolbox } from './toolbox-builder'
import { registeredViews } from '../core/view-registry'
import { cppCategoryDefs } from '../languages/cpp/toolbox-categories'
import { BlockRegistrar } from './block-registrar'
import { createAppLayout, setupSelectors, setupToolbarButtons, setupFileButtons, updateStatusBar } from './app-shell'
import type { AppShellElements } from './app-shell'
import { isFunctionDefinition } from '../core/component/traits'
import { ExecutionController } from './execution-controller'
// Semantic layer
import { allCppConcepts, allCppProjections } from '../languages/cpp/all-declarations'
// Projection layer
import apcsPreset from '../languages/cpp/styles/apcs.json'
import competitivePreset from '../languages/cpp/styles/competitive.json'
import googlePreset from '../languages/cpp/styles/google.json'
import cPreset from '../languages/cpp/styles/c.json'
import { CURRENT_VERSION } from '../core/storage-version'

const STYLE_PRESETS: StylePreset[] = [
  apcsPreset as StylePreset,
  competitivePreset as StylePreset,
  googlePreset as StylePreset,
  // 🔴 **C 風格 2026-08-17 才接上選單**（階段 6.10）——在那之前它
  // 只活在測試裡（`c-style-parity`），**而使用者選不到**。
  // ⚠️ 那正是「機制有了沒人接上」的第六次，而它差一點發生：
  // 本輪把 C 的產出從 6/10 修到 10/10，**而沒有人拿得到那個成果**。
  cPreset as StylePreset,
]

const DEFAULT_STYLE: StylePreset = STYLE_PRESETS[0]

export class App {
  private bus: SemanticBus
  private blocklyPanel: BlocklyPanel | null = null
  private codeView: CodeView | null = null
  private syncController: SyncController | null = null
  private blockSpecRegistry: BlockSpecRegistry
  private blockRegistrar: BlockRegistrar
  private localeLoader: LocaleLoader
  /**
   * 🔴 這個宿主有什麼、沒有什麼——**一份看得完的宣告**。
   *
   * ⚠️ **不要問「現在是哪一個宿主」**，問 `features` 或 `codeView` 的可選方法。
   * 一旦有人寫 `this.profile.id === '…'`，這份宣告就退化成一個標籤
   * ——而真相就散回各處的 `if` 裡了。
   */
  private readonly profile: HostProfile
  private storageService: ReturnType<HostProfile['createStorage']>
  private topicRegistry: TopicRegistry
  private targetRegistry: TargetRegistry
  /**
   * 🔴 **一個實例，兩個持有者**（`code-generator` 的模組層 ＋ `syncController`）。
   * 換目標時要改的是「它的外殼設定」，不是換掉物件——否則會有一個沒被換到。
   */
  private scaffold: CppScaffold | null = null
  private currentTarget: Target
  private executionController: ExecutionController | null = null
  private currentTree: SemanticNode | null = null
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

  constructor(profile: HostProfile) {
    this.profile = profile
    this.bus = new SemanticBus()
    this.blockSpecRegistry = new BlockSpecRegistry()
    this.blockRegistrar = new BlockRegistrar(this.blockSpecRegistry)
    this.localeLoader = new LocaleLoader()
    this.storageService = this.profile.createStorage()
    this.topicRegistry = new TopicRegistry()
    this.targetRegistry = new TargetRegistry()

    // Register topics
    this.topicRegistry.register(cppBeginnerTopic as Topic)
    this.topicRegistry.register(cppCompetitiveTopic as Topic)
    this.topicRegistry.register(cBeginnerTopic as Topic)
    this.topicRegistry.register(arduinoTopic as Topic)

    // ⚠️ **注入而不是 import**——核心的登錄表不認識任何具體目標（P9／中立性護欄）。
    // 目標是「課程清單 ＋ 風格」的具名組合，讓使用者選一次而不是三次。
    this.targetRegistry.register(cppTargetDef as Target)
    this.targetRegistry.register(cTargetDef as Target)
    this.targetRegistry.register(cppCompetitiveTargetDef as Target)
    this.targetRegistry.register(arduinoTargetDef as Target)
    // ⚠️ 既有的 `arduino` **保留**——它省略 `provides` ＝ 提供全部，
    //    意思是「不指定板子」。移除它會讓既有使用者的設定失效。
    this.targetRegistry.register(arduinoUnoTargetDef as Target)
    this.targetRegistry.register(arduinoNanoTargetDef as Target)
    this.targetRegistry.register(esp32TargetDef as Target)

    // Default target → topic and branches (only root level enabled for simplest starting point)
    this.currentTarget = this.targetRegistry.get('cpp')!
    this.currentTopic = this.topicRegistry.get(this.currentTarget.topic)!
    this.enabledBranches = new Set([this.currentTopic.levelTree.id])
  }

  async init(): Promise<void> {
    // 1. Register C++ generators + dependency resolver + scaffold
    registerCppLanguage()
    const registry = createPopulatedRegistry()
    setDependencyResolver(registry)
    this.scaffold = new CppScaffold(registry)
    setProgramScaffold(this.scaffold)
    setScaffoldConfig({ scaffoldDepth: this.getScaffoldDepth() })
    this.localeLoader.setBlocklyMsg(Blockly.Msg as Record<string, string>)
    await this.localeLoader.load('zh-TW')

    // 2. Load block specs (split concept/projection architecture)
    const allConcepts = allCppConcepts()
    const allProjections = allCppProjections()
    this.blockSpecRegistry.loadFromSplit(allConcepts, allProjections)

    // 4. Register all blocks with Blockly
    this.blockRegistrar.registerAll({
      getWorkspace: () => this.blocklyPanel?.getWorkspace() ?? null,
    })

    // 5. Build UI layout
    const appEl = document.getElementById('app')
    if (!appEl) throw new Error('#app element not found')

    const elements: AppShellElements = createAppLayout(appEl, this.blockSpecRegistry, this.callBuildToolbox(), this.profile)
    this.blocklyPanel = elements.blocklyPanel
    this.codeView = elements.codeView
    this.mobileMenu = elements.mobileMenu

    // 6. Create sync controller + wire scaffold + connect panels to bus
    this.syncController = new SyncController(this.bus, 'cpp', DEFAULT_STYLE)
    // 面板的降級路徑要產生程式碼文字，用的必須是**同一組**語言與風格
    // ——面板自己不得寫死一個（FR-003）。見 specs/060-panel-parallel-generator/
    this.blocklyPanel?.setCodeContext('cpp', DEFAULT_STYLE)
    this.syncController.setProgramScaffold(this.scaffold!)
    this.syncController.setScaffoldNodeFilter(cppStripScaffoldNodes)
    const cppPatcher = createCppCodePatcher(registry)
    this.syncController.setCodePatcher((code, tree) => cppPatcher(
      code, tree, this.currentStylePreset.namespace_style, this.getScaffoldDepth(),
      // 🔴 **第二個「要不要 main」的入口**——鷹架是第一個。兩邊都要問同一份宣告。
      this.currentTarget.entryShell ?? 'main',
    ))

    // Inject auto-include nodes into the display tree when scaffold is visible (depth > 0).
    // Auto-includes are generated transiently by computeAutoIncludes() during code generation
    // but not stored as semantic nodes. This enhancer makes them visible as blocks whenever
    // the user is at a level that shows scaffold (i.e., not L0-only mode).
    this.syncController.setDisplayTreeEnhancer((tree, _visible, scaffoldVisible) => {
      if (!scaffoldVisible) return tree
      const autoIncludes = computeAutoIncludes(tree, registry)
      if (autoIncludes.length === 0) return tree
      // 哪個概念代表「引入」是語言套件的知識，介面層不該認得它
      const includeNodes = autoIncludeNodes(autoIncludes)
      return {
        ...tree,
        children: { ...tree.children, body: [...includeNodes, ...(tree.children.body ?? [])] },
      }
    })

    this.syncController.setTopic(this.currentTopic, this.enabledBranches)
    // ── 視圖：登錄，而不是硬編 ────────────────────────────────
    //
    // ⚠️ 這裡原本是一段硬編的 `if (source === …) this.codeView?.setCode(…)`，
    // 而**同時**四個面板各自有一個 `connectBus()` 在訂閱同樣的事件。
    //
    // 查證結果：**`connectBus` 從來沒有人呼叫過**——那一層整個是死的，
    // 真正的線一直是這裡的硬編。
    //
    // > **兩份實作裡有一份是死的時，活的那份會慢慢長出只有它才有的條件**
    // > ——monaco 的自訂閱漏掉 `resync`，而沒有人發現，因為它沒在跑。
    //
    // ⚠️ 這裡曾經寫著「加一個視圖 = registerView(它)，**這個檔不用動**」，
    // 而它下面就是一份手寫的四元素陣列——加第五個視圖一定要改它。
    //
    // > **一個註解宣稱「這個檔不用動」，而它下一行就是要動的地方。**
    //
    // 改成掃描之後那句話才是真的：面板只要實作 `ViewHost` 就會被收。
    // 那是硬體域的 2D／3D 組裝面板、以及板子視圖要接進來的地方
    // （見 `draft/2026-08-05-硬體域併入計畫.md`「視圖：地基已經在了」）。
    const registeredHosts = registerViewsIn(elements)
    // 入口條件（`build-guardrail` 第 9 步）：**掃描器會掃 ≠ 真的掃到東西**。
    // ⚠️ 錨在「有沒有」而不是「有幾個」——後者會在加第五個視圖的那天變紅。
    if (registeredHosts.length === 0) {
      throw new Error(
        'app-shell 沒有回傳任何 ViewHost——視圖登錄表是空的，而症狀是整個畫面都不更新。',
      )
    }
    connectViews(this.bus)
    // 兩個面板還用匯流排做契約外的事，自己接：
    // - `console-panel` **收** `execution:output`
    // - `monaco-panel` **發** `execution:breakpoints`（把行號翻成 nodeId）
    elements.consolePanel?.connectBus(this.bus)
    this.codeView?.connectBus(this.bus)

    // 🔴 **診斷的第二個產出端在樹上，而樹只從匯流排來。**
    //
    // 語法錯誤（少一個分號）的資料標在語義節點上，而 `runDiagnostics` 吃積木
    // ——積木上看不出少了分號（tree-sitter 復原之後那顆積木是完整的）。
    //
    // ⚠️ 而這順帶補上一個既有缺口：診斷原本**只掛在 Blockly 的變更上**
    // （`wireBlocklyChangeHandler`），所以程式碼改動不會直接觸發診斷。
    // `e2e/diagnostics.spec.ts` 的檔頭記過「那是另一條線，今天沒有防線」。
    this.bus.on('semantic:update', (e) => {
      if (e.tree) this.currentTree = e.tree
      this.runAllDiagnostics()
    })

    // 8. Setup code→blocks pipeline
    await this.setupCodeToBlocksPipeline()

    // 9. Wire panel change events
    this.wireBlocklyChangeHandler()
    this.codeView.onChange(() => {
      if (this._codeToBlocksInProgress) return
      this.codeDirty = true
      this.updateSyncHints()
      if (this.autoSync) this.scheduleCodeToBlocksSync()
    })

    // 10. Setup execution controller
    this.executionController = new ExecutionController(
      {
        blocklyPanel: this.blocklyPanel,
        codeView: this.codeView,
        consolePanel: elements.consolePanel,
        variablePanel: elements.variablePanel,
        bottomPanel: elements.bottomPanel,
        syncController: this.syncController,
      },
      {
        // 🔴 **每次執行都問一次**——目標會在執行之間被切換（spec 145）。
        currentBoard: () => this.currentTarget.board as never,
        bus: this.bus,
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
        this.syncController?.syncCodeToBlocks(this.codeView?.getCode())
      },
      onToggleAutoSync: () => this.toggleAutoSync(),
      onUndo: () => this.blocklyPanel?.undo(),
      onRedo: () => this.blocklyPanel?.redo(),
      onClear: () => this.blocklyPanel?.clear(),
    })

    // 🔴 這個宿主沒有檔案按鈕就【不接線】——DOM 根本不存在。
    if (this.profile.features.fileButtons) setupFileButtons(this.storageService, {
      getExportState: () => this.buildSaveState(),
      importState: (state: SavedState) => {
        if (state.blocklyState && Object.keys(state.blocklyState).length > 0) this.blocklyPanel?.setState(state.blocklyState)
        if (state.code) this.codeView?.setCode(state.code)
      },
      onUploadCustomBlocks: (blocks: object[]) => {
        for (const blockDef of blocks) Blockly.common.defineBlocksWithJsonArray([blockDef])
        this.updateToolbox()
        showToast(Blockly.Msg['TOAST_UPLOAD_SUCCESS'] || `Uploaded ${blocks.length} custom blocks`, 'success')
      },
    })

    const selectors = setupSelectors(STYLE_PRESETS, this.targetRegistry, this.topicRegistry, this.currentTarget, this.enabledBranches, {
      // 🔴 **選一次而不是三次**：一個目標同時決定課程清單與風格。
      // ⚠️ 而它**不新寫第三條路**——底下走的仍然是既有的兩條
      //（課程清單那條在這裡、風格那條是 `applyStyle`），
      // 新寫一條會讓「切換之後畫面長什麼樣」有兩個真相來源。
      onTargetChange: (target, topic, branches) => this.handleTargetChange(target, topic, branches),
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
        this.blocklyPanel?.setCodeContext('cpp', style)  // 面板不得落後於同步控制器
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
          requestAnimationFrame(() => this.codeView?.relayout?.())
        })
        // Fallback for devices where rAF fires before paint
        setTimeout(() => this.codeView?.relayout?.(), 100)
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
    const codeView = this.codeView!

    this.syncController!.syncCodeToBlocks = (codeArg?: string) => {
      const code = codeArg ?? codeView.getCode()
      this._codeToBlocksInProgress = true
      parser.parse(code).then(tree => {
        codeParser._lastTree = tree.rootNode
        originalSync(code)
        const patched = this.syncController?.patchMissingDependencies(code)
        if (patched) {
          const linesDelta = patched.split('\n').length - code.split('\n').length
          this.codeView?.setCodePreserveCursor(patched, linesDelta)
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
    this.blocklyPanel?.setCodeContext('cpp', preset)  // 同上
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
      // 🔴 **能力過濾只加在這裡，不加進 `getVisibleConcepts()`。**
      //
      // 那個函式同時餵給 `markOutOfScopeBlocks()`（畫布上的灰階標記），
      // 而把板子過濾加進去會讓**畫布上既有的積木變灰**——那不是本刀的需求，
      // 而且它與既有行為衝突：「workspace 既有積木不受層級切換影響
      // （只影響 toolbox 可用性）」。
      //
      // ⚠️ 學生在 ESP32 下拉了一顆觸摸積木、切到 Uno，**那顆積木要留在畫布上**
      // ——切走一個目標不該吃掉他的作品。
      visibleConcepts: filterByTarget(this.getVisibleConcepts(), this.currentTarget),
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
    const code = this.codeView?.getCode() ?? ''
    const depth = this.getScaffoldDepth()
    const needsRelift = depth > 0 && !(tree.children.body ?? []).some(
      (n: { conceptId: string; properties: Record<string, unknown> }) =>
        isFunctionDefinition(n.conceptId) && n.properties.name === 'main'
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
  /**
   * 換目標——課程清單、風格、鷹架深度一起換。
   *
   * 🔴 這段是從選擇器的 closure **搬**出來的（不是複製），因為現在有**兩個**
   * 呼叫端：使用者在選擇器上選，以及**宿主用組態指定**（`applyHostConfig`）。
   *
   * > **同一件事有兩個入口時，要嘛共用一個實作，
   * > 要嘛就會有兩個「換目標之後畫面長什麼樣」的真相。**
   */
  private handleTargetChange(target: Target, topic: Topic, branches: Set<string>): void {
    // 🔴 **目標自己說它要不要程式外殼**——這一層不認識任何具體的目標。
    this.scaffold?.setEntryShell(target.entryShell ?? 'main')
        const prevDepth = this.getScaffoldDepth()
        this.currentTarget = target
        this.currentTopic = topic
        this.enabledBranches = branches
        // 風格那一半——走既有的 `applyStylePreset`（它同時更新選擇器的顯示值）
        const style = STYLE_PRESETS.find(p => p.id === target.style)
        if (style && style.id !== this.currentStylePreset.id) this.applyStylePreset(style)
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
        // ⚠️ **選擇本身要存**——`autoSave` 只掛在積木變動上（`blocklyPanel.onChange`），
        // 所以在空白工作區換目標，重新整理之後就跑掉了。
        // 🔴 那是既有的缺口（`topicId`／`styleId` 也一樣），而 e2e 才問得出來。
        if (!this._restoringState) this.autoSave()
  }

  /**
   * 照宿主給的組態選目標。
   *
   * ## 🔴 為什麼非有不可
   *
   * 使用者在 Arduino IDE 裡開 `.ino`，而面板用的是 `C++（預設）` 這個目標
   * ——於是**鷹架把 `setup()`／`loop()` 包進了 `int main()`**，
   * 並且加上 `using namespace std;`。⚠️ 那不是顯示問題，**它寫進了使用者的檔案**。
   *
   * `semorphe.target` 這個設定**早就宣告了**（`manifest.ts`），
   * 而 spec 140 把 webview 縮成薄殼時，消費它的那一段掉了
   * ——於是它變成一個**宣告了而沒有人讀**的設定。
   *
   * > **一個沒有人讀的設定，與一個不存在的設定，
   * > 差別只在前者讓人以為已經處理過了。**
   *
   * ⚠️ 認不得的 ID **回退到現況**，不崩潰也不留空白（與 `restoreState` 同一條規矩）。
   */
  applyHostConfig(cfg: { targetId?: string }): void {
    if (!cfg.targetId) return
    const target = this.targetRegistry.get(cfg.targetId)
    if (!target || target.id === this.currentTarget.id) return
    const topic = this.topicRegistry.get(target.topic)
    if (!topic) return
    // 🔴 **不得由此寫回文件。** `handleTargetChange` 在正常路徑上會
    //    `syncBlocksToCodeWithMappings()`——而套用組態發生在**開機時**，
    //    那時工作區是空的，寫回去就是**把使用者的檔案清空**。
    //
    // > **一個「換設定」的動作如果順手寫了檔案，
    // > 那麼在還沒讀到檔案之前換設定，就會把檔案寫成還沒讀到的樣子。**
    //
    // ⚠️ 借用既有的 `_restoringState`（它正是「現在不要寫回去」的意思），
    //    不新開一個旗標——兩個意思一樣的旗標會各自漂移。
    this._restoringState = true
    try {
      this.handleTargetChange(target, topic, new Set([topic.levelTree.id]))
    } finally {
      this._restoringState = false
    }
    this.topicSelector?.setTarget(target, this.enabledBranches)
  }

  private syncBlocksToCodeWithMappings(): void {
    // 🔴 **殘的工作區不得覆蓋程式碼。**
    //
    // `BlocklyPanel` 從語義樹載入積木失敗時只載了一半，而把那半份產生成程式碼
    // 寫回去，等於**把使用者的檔案刪掉一半**。
    //
    // > **兩邊不一致時，不能拿「已知是壞的那一邊」當來源。**
    //
    // ⚠️ 恢復的辦法是按「程式碼→積木」重載一次（成功就會解除）。
    if (this.blocklyPanel?.isStateStale) {
      showToast('積木沒有完整載入，暫停同步到程式碼——請按「程式碼→積木」重載', 'error')
      return
    }
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
      // 🔴 同 `syncBlocksToCodeWithMappings`：殘的工作區不得覆蓋程式碼。
      //    ⚠️ 自動同步這條路才是真正危險的——它不需要使用者按任何東西。
      if (this.blocklyPanel?.isStateStale) return
      this.blocksDirty = true; this.updateSyncHints()
      if (this.autoSync) {
        const tree = this.blocklyPanel?.extractSemanticTree()
        const blockMappings = this.blocklyPanel?.getBlockMappings()
        this.syncController!.syncBlocksToCode(tree, blockMappings)
        this.blocksDirty = false; this.updateSyncHints()
      }
      this.runAllDiagnostics(); this.autoSave()
    })
  }

  private refreshStatusBar(): void {
    updateStatusBar(this.currentStylePreset, this.currentLocale, this.currentBlockStyleId, this.currentTopic.name, this.mobileMenu)
  }

  private setupBidirectionalHighlight(): void {
    // Block → Code: unified via nodeId
    this.blocklyPanel?.onNodeSelect((nodeId) => {
      this.codeView?.clearHighlight(); this.blocklyPanel?.clearHighlight()
      if (!nodeId) return
      this.blocklyPanel?.highlightByNodeId(nodeId, 'block-to-code')
      const range = this.syncController?.codeRangeForNode(nodeId)
      if (range) this.codeView?.addHighlight(range.startLine + 1, range.endLine + 1, 'block-to-code')
    })
    // Code → Block: unified via nodeId
    this.codeView?.onCursorChange((line: number) => {
      this.blocklyPanel?.clearHighlight(); this.codeView?.clearHighlight(); this.codeView?.dismissPendingHighlight()
      try { if (Blockly.getSelected()) Blockly.common.setSelected(null as unknown as Blockly.ISelectable) } catch { /* ignore */ }
      const nodeId = this.syncController?.nodeIdForLine(line - 1)
      if (!nodeId) return
      this.blocklyPanel?.highlightByNodeId(nodeId, 'code-to-block')
      const range = this.syncController?.codeRangeForNode(nodeId)
      if (range) this.codeView?.addHighlight(range.startLine + 1, range.endLine + 1, 'code-to-block')
    })
  }

  /**
   * ⚠️ `version` 必須是 `CURRENT_VERSION`，不是寫死的數字。
   *
   * 這裡原本寫 `version: 1`。自動存檔沒事——`storage.save()` 會強制蓋成
   * `CURRENT_VERSION`。**而匯出繞過 `save()`**（`getExportState()` →
   * `exportToBlob()`），所以每一份匯出的 `.json` 都自稱 v1，
   * 匯入時被跑過**八次**它不需要的升級。
   *
   * 今天沒有壞，因為那八次在現有資料上是冪等的（實測樹逐字未變）。
   * 但那是**巧合不是保證**——116 正要加一個會改寫積木狀態的 v10 步驟，
   * 而一份自稱 v1 的檔案會走到它。
   *
   * > **一個欄位有兩個寫入點，其中一個是對的，症狀就只在另一條路上出現。**
   *
   * 2026-08-11 錄 v9 存檔樣本時發現：localStorage 裡是 9，匯出的檔是 1。
   */
  private buildSaveState(): SavedState {
    return { version: CURRENT_VERSION, tree: this.syncController?.getCurrentTree() ?? null,
      blocklyState: this.blocklyPanel?.getState() ?? {}, code: this.codeView?.getCode() ?? '',
      language: 'cpp', styleId: this.currentStylePreset.id,
      topicId: this.currentTopic.id, targetId: this.currentTarget.id, enabledBranches: [...this.enabledBranches],
      lastModified: new Date().toISOString(), blockStyleId: this.currentBlockStyleId, locale: this.currentLocale }
  }

  private autoSave(): void {
    this.storageService.save(this.buildSaveState())
  }

  private restoreState(): void {
    const outcome = this.storageService.loadOutcome()

    // 「沒有存檔」與「存檔被拒絕」必須分開。混在一起的話，使用者會以為這是
    // 新的一頁，動一下就觸發自動存檔，把載不進來的那份蓋掉。
    // 見 specs/052-storage-integrity-gate/research.md F3
    if (outcome.kind === 'refused') {
      showToast(describeRefusal(outcome), 'warning')
      return
    }
    if (outcome.kind === 'empty') return

    const state = outcome.state

    // 1. Restore blocks FIRST (before level change triggers resync)
    if (state.blocklyState && Object.keys(state.blocklyState).length > 0) {
      this.blocklyPanel?.setState(state.blocklyState)
    }

    // 2. Restore topic and branches WITHOUT triggering resyncAfterTopicChange
    this._restoringState = true
    // ⚠️ `targetId` 優先，回退到 `topicId`——舊存檔（spec 136 之前）只有後者。
    // 🔴 而**認不得的 ID 一律回退到預設**，不得崩潰或留下一片空白。
    const savedTarget = state.targetId ? this.targetRegistry.get(state.targetId) : undefined
    if (savedTarget) this.currentTarget = savedTarget
    // ⚠️ 還原也要跟著換外殼——否則存檔存的是 Arduino，開起來卻套 `main()`。
    this.scaffold?.setEntryShell(this.currentTarget.entryShell ?? 'main')
    const topicId = savedTarget?.topic ?? state.topicId
    if (topicId) {
      const topic = this.topicRegistry.get(topicId)
      if (topic) {
        this.currentTopic = topic
        this.enabledBranches = state.enabledBranches
          ? new Set(state.enabledBranches)
          : new Set([topic.levelTree.id])
      }
    }
    // 舊存檔沒有 `targetId`，而它的 `styleId` 仍然照舊生效（下面既有的還原路徑）。
    if (savedTarget) {
      const style = STYLE_PRESETS.find(p => p.id === savedTarget.style)
      if (style && style.id !== this.currentStylePreset.id) this.applyStylePreset(style)
    }
    setScaffoldConfig({ scaffoldDepth: this.getScaffoldDepth() })
    this.syncController?.setTopic(this.currentTopic, this.enabledBranches)
    this.topicSelector?.setTarget(this.currentTarget, this.enabledBranches)
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
      this.syncController?.syncCodeToBlocks(this.codeView?.getCode())
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
    if (this.codeDirty) this.syncController?.syncCodeToBlocks(this.codeView?.getCode())
  }

  /**
   * 跑診斷並**廣播**。
   *
   * ## 🔴 廣播，不是命令（2026-08-14 換的）
   *
   * 這裡原本直接 `block.setWarningText(...)`——**執行端知道每個視圖該畫什麼**，
   * 而那正是 `execution:at-node` 那次收攏掉的東西（`history/051`）。
   * 現在它只說「診斷變了」，各視圖自己決定怎麼呈現。
   *
   * ⚠️ **空陣列也要廣播**：那是「沒有問題」，不是「沒有跑」——
   * 不廣播的話舊的波浪與警告不會被清掉。
   */
  /**
   * **兩個產出端，一次廣播。**
   *
   * ```
   * 規則吃積木   空插槽、欄位值           source: 'component'
   * 樹的性質     語法錯誤（少分號等）      source: 'parser'
   * ```
   *
   * 🔴 **不可以分兩次廣播**：`setModelMarkers` 與 `setWarningText(null)` 的語義
   * 都是**全集取代**——第二次會把第一次清掉。
   */
  private runAllDiagnostics(): void {
    const workspace = this.blocklyPanel?.getWorkspace()
    if (!workspace) return
    const allBlocks = workspace.getAllBlocks(false)

    // blockId → nodeId。**規則吃積木，而錨點是語義的**——轉換在這裡。
    const toNodeId = this.syncController?.getBlockIdToNodeIdMap() ?? new Map<string, string>()

    const adapt = (block: Blockly.Block): DiagnosticBlock => ({
      id: block.id, type: block.type,
      // ⚠️ 查不到對映時**退回 blockId**：那顆積木還沒被抽成語義節點
      // （剛拖出來、還沒同步）。用 blockId 當錨點的話積木視圖仍找得到它，
      // 而程式碼視圖找不到——**那是誠實的：那顆積木在程式碼裡本來就還不存在。**
      nodeId: toNodeId.get(block.id) ?? block.id,
      getFieldValue: (n: string) => block.getFieldValue(n),
      getInputTargetBlock: (n: string) => {
        const t = block.getInputTargetBlock(n)
        return t ? { id: t.id, nodeId: toNodeId.get(t.id) ?? t.id, type: t.type, getFieldValue: (x: string) => t.getFieldValue(x), getInputTargetBlock: () => null, getInput: (x: string) => t.getInput(x) } : null
      },
      getInput: (n: string) => block.getInput(n),
    })

    const diagnostics = [
      ...runDiagnostics(allBlocks.map(adapt), cppDiagnosticRules),
      ...(this.currentTree ? diagnosticsFromTree(this.currentTree) : []),
    ]
    for (const v of registeredViews()) v.onDiagnostics?.({ diagnostics })
  }

  dispose(): void {
    this.blocklyPanel?.dispose()
    this.codeView?.dispose()
    this.executionController?.dispose()
  }
}
