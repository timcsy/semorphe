import * as Blockly from 'blockly'
import { FieldMultilineInput } from '@blockly/field-multilineinput'
import { BlocklyPanel } from './panels/blockly-panel'
import { MonacoPanel } from './panels/monaco-panel'
import { SplitPane } from './layout/split-pane'
import { BottomPanel } from './layout/bottom-panel'
import { ConsolePanel } from './panels/console-panel'
import { VariablePanel } from './panels/variable-panel'
import { SyncController } from './sync-controller'
import type { SyncError } from './sync-controller'
import { SemanticInterpreter } from '../interpreter/interpreter'
import { StepController } from './step-controller'
import { DebugToolbar } from './debug-toolbar'
import type { StepInfo, ExecutionSpeed } from '../interpreter/types'
import type { SemanticNode as InterpreterNode } from '../core/types'
import { RuntimeError } from '../interpreter/errors'
import { showToast } from './toolbar/toast'
import { showStyleActionBar } from './toolbar/style-action-bar'
import { QuickAccessBar } from './toolbar/quick-access-bar'
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
import { LevelSelector } from './toolbar/level-selector'
import { StyleSelector } from './toolbar/style-selector'
import { BlockStyleSelector } from './toolbar/block-style-selector'
import { LocaleSelector } from './toolbar/locale-selector'
import type { BlockStylePreset } from '../languages/style'
import { isBlockAvailable, getBlockLevel } from '../core/cognitive-levels'
import type { StylePreset, BlockSpec, CognitiveLevel } from '../core/types'
import { CATEGORY_COLORS, DEGRADATION_VISUALS } from './theme/category-colors'
import universalBlocks from '../blocks/universal.json'
import { IF_INPUTS, WHILE_INPUTS, COUNT_LOOP_INPUTS } from '../blocks/block-input-names'
import cppBasicBlocks from '../languages/cpp/blocks/basic.json'
import cppSpecialBlocks from '../languages/cpp/blocks/special.json'
import cppAdvancedBlocks from '../languages/cpp/blocks/advanced.json'
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
  private blocklyPanel: BlocklyPanel | null = null
  private monacoPanel: MonacoPanel | null = null
  private syncController: SyncController | null = null
  private blockSpecRegistry: BlockSpecRegistry
  private localeLoader: LocaleLoader
  private storageService: StorageService
  private levelSelector: LevelSelector | null = null
  private consolePanel: ConsolePanel | null = null
  private variablePanel: VariablePanel | null = null
  private bottomPanel: BottomPanel | null = null
  private interpreter: SemanticInterpreter | null = null
  private stepController: StepController | null = null
  private debugToolbar: DebugToolbar | null = null
  private runMode: 'run' | 'debug' | 'animate-slow' | 'animate-medium' | 'animate-fast' | 'step' = 'run'
  private stepRecords: StepInfo[] = []
  private currentStepIndex = -1
  private blocksDirty = false
  private codeDirty = false
  private autoSync = true
  private codeToBlocksTimer: ReturnType<typeof setTimeout> | null = null
  private quickAccessBar: QuickAccessBar | null = null
  private currentLevel: CognitiveLevel = 1
  private currentIoPreference: 'iostream' | 'cstdio' = 'iostream'
  private _codeToBlocksInProgress = false

  constructor() {
    this.blockSpecRegistry = new BlockSpecRegistry()
    this.localeLoader = new LocaleLoader()
    this.storageService = new StorageService()
  }

  async init(): Promise<void> {
    // 1. Register C++ code generators
    registerCppLanguage()

    // 2. Load locale
    this.localeLoader.setBlocklyMsg(Blockly.Msg as Record<string, string>)
    await this.localeLoader.load('zh-TW')

    // 3. Load block specs
    this.blockSpecRegistry.loadFromJSON(universalBlocks as unknown as BlockSpec[])
    this.blockSpecRegistry.loadFromJSON(cppBasicBlocks as unknown as BlockSpec[])
    this.blockSpecRegistry.loadFromJSON(cppSpecialBlocks as unknown as BlockSpec[])
    // Load stdlib first so advanced.json (with i18n BKY_ messages) takes precedence for duplicates
    this.blockSpecRegistry.loadFromJSON(cppStdlibContainers as unknown as BlockSpec[])
    this.blockSpecRegistry.loadFromJSON(cppStdlibAlgorithms as unknown as BlockSpec[])
    this.blockSpecRegistry.loadFromJSON(cppAdvancedBlocks as unknown as BlockSpec[])

    // 4. Register all blocks with Blockly from JSON definitions
    this.registerBlocksFromSpecs()

    // 5. Build UI layout
    const appEl = document.getElementById('app')
    if (!appEl) throw new Error('#app element not found')

    // Create toolbar
    const toolbar = document.createElement('header')
    toolbar.id = 'toolbar'
    toolbar.innerHTML = `
      <div class="toolbar-left">
        <span class="toolbar-title">Code Blockly</span>
      </div>
      <div class="toolbar-actions">
        <button id="auto-sync-btn" class="auto-sync-on" title="自動同步：開啟">⇄ 自動</button>
        <button id="sync-blocks-btn" title="積木 → 程式碼">積木→程式碼</button>
        <button id="sync-code-btn" title="程式碼 → 積木">程式碼→積木</button>
        <span class="toolbar-separator"></span>
        <span id="level-selector-mount"></span>
        <span class="toolbar-separator"></span>
        <span id="style-selector-mount"></span>
        <span id="block-style-selector-mount"></span>
        <span id="locale-selector-mount"></span>
        <span class="toolbar-separator"></span>
        <button id="undo-btn" title="復原">↩</button>
        <button id="redo-btn" title="重做">↪</button>
        <button id="clear-btn" title="清空">清空</button>
        <span class="toolbar-separator"></span>
        <button id="export-btn" title="匯出">匯出</button>
        <button id="import-btn" title="匯入">匯入</button>
        <button id="upload-blocks-btn" title="上傳自訂積木">上傳積木</button>
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

    // 6. Initialize Blockly panel with QuickAccessBar above
    const leftPanel = splitPane.getLeftPanel()
    leftPanel.style.display = 'flex'
    leftPanel.style.flexDirection = 'column'

    this.quickAccessBar = new QuickAccessBar(leftPanel)
    this.quickAccessBar.onBlockCreate((blockType) => {
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

    const blocklyContainer = document.createElement('div')
    blocklyContainer.id = 'blockly-panel'
    blocklyContainer.style.flex = '1'
    blocklyContainer.style.overflow = 'hidden'
    leftPanel.appendChild(blocklyContainer)

    this.blocklyPanel = new BlocklyPanel({ container: blocklyContainer, blockSpecRegistry: this.blockSpecRegistry })
    this.blocklyPanel.init(this.buildToolbox())

    // 7. Initialize right side: Monaco on top, BottomPanel below
    const rightColumn = splitPane.getRightPanel()
    rightColumn.classList.add('right-column')

    const monacoWrapper = document.createElement('div')
    monacoWrapper.className = 'monaco-wrapper'
    monacoWrapper.id = 'monaco-panel'
    rightColumn.appendChild(monacoWrapper)

    this.monacoPanel = new MonacoPanel(monacoWrapper)
    this.monacoPanel.init(false) // editable for US2

    // 7b. BottomPanel with Console + Variable tabs
    const bottomContainer = document.createElement('div')
    rightColumn.appendChild(bottomContainer)
    this.bottomPanel = new BottomPanel(bottomContainer)

    const consoleEl = document.createElement('div')
    this.consolePanel = new ConsolePanel(consoleEl)
    this.bottomPanel.addTab({
      id: 'console',
      label: Blockly.Msg['PANEL_CONSOLE'] || 'Console',
      panel: consoleEl,
      actions: [{ icon: Blockly.Msg['PANEL_CLEAR'] || '清除', title: 'Clear', onClick: () => this.consolePanel?.clear() }],
    })

    const variableEl = document.createElement('div')
    this.variablePanel = new VariablePanel(variableEl)
    this.bottomPanel.addTab({ id: 'variables', label: Blockly.Msg['PANEL_VARIABLES'] || 'Variables', panel: variableEl })

    // 8. Create sync controller
    this.syncController = new SyncController(
      this.blocklyPanel,
      this.monacoPanel,
      'cpp',
      DEFAULT_STYLE,
    )

    // 8b. Setup code→blocks pipeline (US2)
    await this.setupCodeToBlocksPipeline()

    // 9. Wire events
    this.blocklyPanel.onChange(() => {
      if (this._codeToBlocksInProgress) return
      this.blocksDirty = true
      this.updateSyncHints()
      if (this.autoSync) {
        this.syncController!.syncBlocksToCode()
        this.blocksDirty = false
        this.updateSyncHints()
      }
      this.runBlockDiagnostics()
      this.autoSave()
    })

    // Code change detection for sync hint (with debounce for auto-sync)
    this.monacoPanel.onChange(() => {
      if (this._codeToBlocksInProgress) return
      this.codeDirty = true
      this.updateSyncHints()
      if (this.autoSync) {
        this.scheduleCodeToBlocksSync()
      }
    })

    // 10. Setup toolbar buttons + selectors + execution + highlighting
    this.setupToolbar()
    this.setupExecution()
    this.setupBidirectionalHighlight()

    this.setupLevelSelector()
    this.setupStyleSelector()
    this.setupBlockStyleSelector()
    this.setupLocaleSelector()

    // 11. Update status bar with initial state
    this.updateStatusBar()

    // 12. Restore saved state
    this.restoreState()
  }

  private registerBlocksFromSpecs(): void {
    const specs = this.blockSpecRegistry.getAll()
    for (const spec of specs) {
      const blockDef = spec.blockDef
      const blockType = blockDef?.type as string | undefined
      if (!blockType) continue
      if (Blockly.Blocks[blockType]) continue

      // Register basic blocks from JSON definition
      Blockly.Blocks[blockType] = {
        init: function (this: Blockly.Block) {
          this.jsonInit(blockDef)
        },
      }
    }

    // Register dynamic blocks that need custom init
    this.registerDynamicBlocks()
  }

  /**
   * Create a FieldDropdown that accepts any value during deserialization.
   * Blockly's default doClassValidation_ rejects values not in the options list,
   * but dynamic dropdowns (workspace vars, funcs, arrays) often receive values
   * that aren't yet in the list when blocks are first loaded.
   */
  private createOpenDropdown(optionsGenerator: () => Array<[string, string]>): Blockly.FieldDropdown {
    const field = new Blockly.FieldDropdown(optionsGenerator)
    // Override validation to always accept any non-null value
    ;(field as any).doClassValidation_ = function (newValue: string) {
      if (newValue === null || newValue === undefined) return null
      // Ensure the value is in the options for display
      const options = this.getOptions(false)
      if (!options.some((o: string[]) => o[1] === newValue)) {
        options.push([newValue, newValue])
      }
      return newValue
    }
    return field
  }

  private registerDynamicBlocks(): void {
    // +/- button SVG icons (shared across all dynamic blocks)
    // Plus: mint green, Minus: pink, Disabled: light gray
    const PLUS_IMG = 'data:image/svg+xml,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20">' +
      '<circle cx="10" cy="10" r="9" fill="#66CDAA"/>' +
      '<path d="M6 10h8M10 6v8" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>'
    )
    const MINUS_IMG = 'data:image/svg+xml,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20">' +
      '<circle cx="10" cy="10" r="9" fill="#F08080"/>' +
      '<path d="M6 10h8" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>'
    )
    const MINUS_DISABLED_IMG = 'data:image/svg+xml,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20">' +
      '<circle cx="10" cy="10" r="9" fill="#E0E0E0"/>' +
      '<path d="M6 10h8" stroke="#BDBDBD" stroke-width="2" stroke-linecap="round"/></svg>'
    )
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const self = this
    const setMinusState = (block: any, isAtMin: boolean) => {
      const f = block.getField('MINUS_BTN')
      if (f) f.setValue(isAtMin ? MINUS_DISABLED_IMG : MINUS_IMG)
    }

    // u_string — override to preserve whitespace display in SVG
    {
      Blockly.Blocks['u_string'] = {
        init: function (this: any) {
          const field = new Blockly.FieldTextInput('hello')
          // Override display to use NBSP so SVG doesn't collapse spaces
          field.getDisplayText_ = function (this: any) {
            const val = this.getValue() ?? ''
            // Replace regular spaces with non-breaking spaces for SVG rendering
            return val.replace(/ /g, '\u00A0') || '\u00A0'
          }
          this.appendDummyInput()
            .appendField('"')
            .appendField(field as Blockly.Field, 'TEXT')
            .appendField('"')
          this.setOutput(true, 'Expression')
          this.setColour(CATEGORY_COLORS.data)
          this.setTooltip(Blockly.Msg['U_STRING_TOOLTIP'] || '文字')
        },
      }
    }

    // Type options for variable declarations (shared by u_var_declare, c_var_declare_expr, etc.)
    const getTypeOptions = (currentVal?: string): Array<[string, string]> => {
        const opts: Array<[string, string]> = [
          [Blockly.Msg['U_VAR_DECLARE_TYPE_INT'] || 'int', 'int'],
          [Blockly.Msg['U_VAR_DECLARE_TYPE_FLOAT'] || 'float', 'float'],
          [Blockly.Msg['U_VAR_DECLARE_TYPE_DOUBLE'] || 'double', 'double'],
          [Blockly.Msg['U_VAR_DECLARE_TYPE_CHAR'] || 'char', 'char'],
          [Blockly.Msg['U_VAR_DECLARE_TYPE_BOOL'] || 'bool', 'bool'],
          [Blockly.Msg['U_VAR_DECLARE_TYPE_STRING'] || 'string', 'string'],
          [Blockly.Msg['U_VAR_DECLARE_TYPE_LONG_LONG'] || 'long long', 'long long'],
        ]
        // Fallback: if current value isn't in options (e.g., void*, int*), add it
        if (currentVal && !opts.some(o => o[1] === currentVal)) {
          opts.unshift([currentVal, currentVal])
        }
        return opts
      }

      // Mutator helper blocks for u_var_declare
      Blockly.Blocks['u_var_declare_container'] = {
        init: function (this: Blockly.Block) {
          this.appendDummyInput().appendField(Blockly.Msg['U_VAR_DECLARE_HEADER'] || '宣告')
          this.appendStatementInput('STACK')
          this.setColour(CATEGORY_COLORS.data)
          this.contextMenu = false
        },
      }
      Blockly.Blocks['u_var_declare_var_input'] = {
        init: function (this: Blockly.Block) {
          this.appendDummyInput().appendField(Blockly.Msg['U_VAR_DECLARE_VAR_LABEL'] || '變數')
          this.setPreviousStatement(true)
          this.setNextStatement(true)
          this.setColour(CATEGORY_COLORS.data)
          this.contextMenu = false
        },
      }
      Blockly.Blocks['u_var_declare_var_init_input'] = {
        init: function (this: Blockly.Block) {
          this.appendDummyInput().appendField(Blockly.Msg['U_VAR_DECLARE_VAR_INIT_LABEL'] || '變數 = 值')
          this.setPreviousStatement(true)
          this.setNextStatement(true)
          this.setColour(CATEGORY_COLORS.data)
          this.contextMenu = false
        },
      }

      Blockly.Blocks['u_var_declare'] = {
        items_: ['var_init'] as string[],
        init: function (this: any) {
          this.items_ = ['var_init']
          this.appendDummyInput('HEADER')
            .appendField(Blockly.Msg['U_VAR_DECLARE_HEADER'] || '宣告')
            .appendField(self.createOpenDropdown(() => getTypeOptions()) as Blockly.Field, 'TYPE')
            .appendField(Blockly.Msg['U_VAR_DECLARE_VAR_WORD'] || '變數')
          this.appendValueInput('INIT_0')
            .appendField(new Blockly.FieldTextInput('x') as Blockly.Field, 'NAME_0')
            .appendField('=')
          this.appendDummyInput('TAIL')
            .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plus_()))
            .appendField(new Blockly.FieldImage(MINUS_DISABLED_IMG, 20, 20, '-', () => this.minus_()), 'MINUS_BTN')
          this.setInputsInline(true)
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setColour(CATEGORY_COLORS.data)
          this.setTooltip(Blockly.Msg['U_VAR_DECLARE_TOOLTIP'] || '宣告變數')
          this.setMutator(new Blockly.icons.MutatorIcon(
            ['u_var_declare_var_input', 'u_var_declare_var_init_input'],
            this as unknown as Blockly.BlockSvg,
          ))
        },
        plus_: function (this: any) {
          const idx = this.items_.length
          this.items_.push('var_init')
          this.appendValueInput(`INIT_${idx}`)
            .appendField(',')
            .appendField(new Blockly.FieldTextInput(`v${idx}`) as Blockly.Field, `NAME_${idx}`)
            .appendField('=')
          this.moveInputBefore(`INIT_${idx}`, 'TAIL')
          setMinusState(this, false)
        },
        minus_: function (this: any) {
          if (this.items_.length <= 1) return
          const idx = this.items_.length - 1
          this.items_.pop()
          if (this.getInput(`INIT_${idx}`)) this.removeInput(`INIT_${idx}`)
          if (this.getInput(`VAR_${idx}`)) this.removeInput(`VAR_${idx}`)
          setMinusState(this, this.items_.length <= 1)
        },
        saveExtraState: function (this: any) {
          return { items: this.items_ }
        },
        loadExtraState: function (this: any, state: { items?: string[] }) {
          this.items_ = state?.items ?? ['var_init']
          this.rebuildInputs_()
        },
        rebuildInputs_: function (this: any) {
          // Save connected blocks and names
          const savedBlocks: (Blockly.Block | null)[] = []
          const savedNames: string[] = []
          for (let i = 0; ; i++) {
            const initInput = this.getInput(`INIT_${i}`)
            const varInput = this.getInput(`VAR_${i}`)
            if (!initInput && !varInput) break
            savedNames.push(this.getFieldValue(`NAME_${i}`) ?? `v${i}`)
            if (initInput) {
              savedBlocks.push(initInput.connection?.targetBlock() ?? null)
            } else {
              savedBlocks.push(null)
            }
          }
          // Remove all existing var rows
          for (let i = 0; ; i++) {
            if (!this.getInput(`INIT_${i}`) && !this.getInput(`VAR_${i}`)) break
            if (this.getInput(`INIT_${i}`)) this.removeInput(`INIT_${i}`)
            if (this.getInput(`VAR_${i}`)) this.removeInput(`VAR_${i}`)
          }
          // Remove and re-add TAIL
          if (this.getInput('TAIL')) this.removeInput('TAIL')
          // Rebuild rows
          for (let j = 0; j < this.items_.length; j++) {
            const name = savedNames[j] ?? `v${j}`
            if (this.items_[j] === 'var_init') {
              const input = this.appendValueInput(`INIT_${j}`)
              if (j > 0) input.appendField(',')
              input.appendField(new Blockly.FieldTextInput(name) as Blockly.Field, `NAME_${j}`)
                .appendField('=')
              if (savedBlocks[j] && this.getInput(`INIT_${j}`)?.connection) {
                this.getInput(`INIT_${j}`)!.connection!.connect(savedBlocks[j]!.outputConnection!)
              }
            } else {
              const input = this.appendDummyInput(`VAR_${j}`)
              if (j > 0) input.appendField(',')
              input.appendField(new Blockly.FieldTextInput(name) as Blockly.Field, `NAME_${j}`)
            }
          }
          // Re-add TAIL
          this.appendDummyInput('TAIL')
            .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plus_()))
            .appendField(new Blockly.FieldImage(
              this.items_.length <= 1 ? MINUS_DISABLED_IMG : MINUS_IMG,
              20, 20, '-', () => this.minus_()), 'MINUS_BTN')
        },
        decompose: function (this: any, workspace: Blockly.WorkspaceSvg) {
          const containerBlock = workspace.newBlock('u_var_declare_container')
          containerBlock.initSvg()
          let connection = containerBlock.getInput('STACK')!.connection!
          for (let i = 0; i < this.items_.length; i++) {
            const type = this.items_[i] === 'var_init'
              ? 'u_var_declare_var_init_input'
              : 'u_var_declare_var_input'
            const itemBlock = workspace.newBlock(type)
            itemBlock.initSvg()
            connection.connect(itemBlock.previousConnection!)
            connection = itemBlock.nextConnection!
          }
          return containerBlock
        },
        compose: function (this: any, containerBlock: Blockly.Block) {
          const newItems: string[] = []
          let clauseBlock = containerBlock.getInputTargetBlock('STACK')
          while (clauseBlock) {
            if (clauseBlock.type === 'u_var_declare_var_init_input') {
              newItems.push('var_init')
            } else if (clauseBlock.type === 'u_var_declare_var_input') {
              newItems.push('var')
            }
            clauseBlock = clauseBlock.getNextBlock()
          }
          if (newItems.length === 0) newItems.push('var_init')
          this.items_ = newItems
          this.rebuildInputs_()
        },
      }

    // u_print with +/- buttons + inline layout
    {
      Blockly.Blocks['u_print'] = {
        itemCount_: 1,
        init: function (this: any) {
          this.itemCount_ = 1
          this.appendValueInput('EXPR0')
            .appendField(Blockly.Msg['U_PRINT_MSG'] || '輸出')
          this.appendDummyInput('TAIL')
            .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plus_()))
            .appendField(new Blockly.FieldImage(MINUS_DISABLED_IMG, 20, 20, '-', () => this.minus_()), 'MINUS_BTN')
          this.setInputsInline(true)
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setColour(CATEGORY_COLORS.io)
          this.setTooltip(Blockly.Msg['U_PRINT_TOOLTIP'] || '輸出值')
        },
        plus_: function (this: any) {
          this.appendValueInput('EXPR' + this.itemCount_)
          this.moveInputBefore('EXPR' + this.itemCount_, 'TAIL')
          this.itemCount_++
          setMinusState(this, false)
        },
        minus_: function (this: any) {
          if (this.itemCount_ <= 1) return
          this.itemCount_--
          this.removeInput('EXPR' + this.itemCount_)
          setMinusState(this, this.itemCount_ <= 1)
        },
        saveExtraState: function (this: any) {
          return { itemCount: this.itemCount_ }
        },
        loadExtraState: function (this: any, state: { itemCount?: number }) {
          const count = state?.itemCount ?? 1
          while (this.itemCount_ < count) {
            this.plus_()
          }
        },
      }
    }

    // ─── Three-mode argument helpers (select / compose / custom) ───
    // Shared by u_input, c_printf, c_scanf
    const BACK_IMG = 'data:image/svg+xml,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">' +
      '<circle cx="8" cy="8" r="7" fill="#90CAF9"/>' +
      '<path d="M10 5L6 8l4 3" stroke="#fff" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    )
    const COMPOSE_VAL = '__COMPOSE__'
    const CUSTOM_VAL = '__CUSTOM__'

    type ArgMode = 'select' | 'compose' | 'custom'
    interface ArgSlotState { mode: ArgMode; text?: string }

    // Build a three-mode arg slot at index i on the given block.
    // `inputName` is the base name (e.g. 'ARG_0'), `prefix` is the label before the first slot.
    const buildArgSlot = (block: any, idx: number, mode: ArgMode, opts: {
      getVarOptions: () => Array<[string, string]>,
      inputPrefix?: string,
      separator?: string,
      defaultVar?: string,
      customDefault?: string,
    }) => {
      const inputName = `ARG_${idx}`
      // Remove old input for this slot if it exists
      if (block.getInput(inputName)) block.removeInput(inputName)

      if (mode === 'select') {
        const currentVal = block.argSlots_?.[idx]?.selectedVar
        const dd = new Blockly.FieldDropdown(function () {
          const vopts = opts.getVarOptions()
          if (currentVal && !vopts.some((o: [string, string]) => o[1] === currentVal)) {
            vopts.unshift([currentVal, currentVal])
          }
          vopts.push([Blockly.Msg['U_ARG_MODE_COMPOSE'] || '(用積木組合)', COMPOSE_VAL])
          vopts.push([Blockly.Msg['U_ARG_MODE_CUSTOM'] || '(自訂文字)', CUSTOM_VAL])
          return vopts
        }) as Blockly.Field
        const inp = block.appendDummyInput(inputName)
        if (idx === 0 && opts.inputPrefix) inp.appendField(opts.inputPrefix)
        else if (idx > 0) inp.appendField(opts.separator ?? '>>')
        inp.appendField(dd, `SEL_${idx}`)
        // Validator: switch mode on special selection
        ;(dd as any).setValidator(function (this: any, newVal: string) {
          if (newVal === COMPOSE_VAL) {
            setTimeout(() => {
              block.argSlots_[idx] = { mode: 'compose' }
              rebuildArgSlot(block, idx, 'compose', opts)
            }, 0)
            return null  // reject, rebuild will happen
          }
          if (newVal === CUSTOM_VAL) {
            setTimeout(() => {
              block.argSlots_[idx] = { mode: 'custom', text: opts.customDefault ?? '' }
              rebuildArgSlot(block, idx, 'custom', opts)
            }, 0)
            return null
          }
          if (block.argSlots_) block.argSlots_[idx] = { mode: 'select', selectedVar: newVal }
          return newVal
        })
      } else if (mode === 'compose') {
        const inp = block.appendValueInput(inputName).setCheck('Expression')
        if (idx === 0 && opts.inputPrefix) inp.appendField(opts.inputPrefix)
        else if (idx > 0) inp.appendField(opts.separator ?? '>>')
        inp.appendField(new Blockly.FieldImage(BACK_IMG, 16, 16,
          Blockly.Msg['U_ARG_MODE_BACK'] || '↩', () => {
            block.argSlots_[idx] = { mode: 'select' }
            rebuildArgSlot(block, idx, 'select', opts)
          }))
      } else {
        // custom text
        const inp = block.appendDummyInput(inputName)
        if (idx === 0 && opts.inputPrefix) inp.appendField(opts.inputPrefix)
        else if (idx > 0) inp.appendField(opts.separator ?? '>>')
        inp.appendField(new Blockly.FieldImage(BACK_IMG, 16, 16,
          Blockly.Msg['U_ARG_MODE_BACK'] || '↩', () => {
            block.argSlots_[idx] = { mode: 'select' }
            rebuildArgSlot(block, idx, 'select', opts)
          }))
        inp.appendField(new Blockly.FieldTextInput(
          block.argSlots_?.[idx]?.text ?? opts.customDefault ?? ''
        ) as Blockly.Field, `TEXT_${idx}`)
      }
    }

    const rebuildArgSlot = (block: any, idx: number, mode: ArgMode, opts: Parameters<typeof buildArgSlot>[3]) => {
      // Save connected block if switching from compose
      const savedBlock = (mode !== 'compose' && block.getInput(`ARG_${idx}`)?.connection)
        ? block.getInputTargetBlock(`ARG_${idx}`)
        : null
      if (block.getInput(`ARG_${idx}`)) block.removeInput(`ARG_${idx}`)
      buildArgSlot(block, idx, mode, opts)
      // Reorder: move ARG_idx before the next slot or TAIL
      const nextInput = block.getInput(`ARG_${idx + 1}`) ? `ARG_${idx + 1}` : 'TAIL'
      block.moveInputBefore(`ARG_${idx}`, nextInput)
      // Reconnect if switching back from compose to select/custom, disconnect child
      if (savedBlock) {
        try { savedBlock.unplug() } catch (_e) { /* ignore */ }
      }
    }

    // u_input with three-mode + multi-arg
    {
      Blockly.Blocks['u_input'] = {
        argCount_: 1,
        argSlots_: [{ mode: 'select' }] as ArgSlotState[],
        init: function (this: any) {
          this.argCount_ = 1
          this.argSlots_ = [{ mode: 'select', selectedVar: 'x' }]
          buildArgSlot(this, 0, 'select', {
            getVarOptions: () => self.getWorkspaceVarOptions(),
            inputPrefix: Blockly.Msg['U_INPUT_LABEL'] || '讀取輸入 →',
            defaultVar: 'x',
          })
          // Set default selection
          try { this.setFieldValue('x', 'SEL_0') } catch (_e) { /* ignore */ }
          this.appendDummyInput('TAIL')
            .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plus_()))
            .appendField(new Blockly.FieldImage(MINUS_DISABLED_IMG, 20, 20, '-', () => this.minus_()), 'MINUS_BTN')
          this.setInputsInline(true)
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setColour(CATEGORY_COLORS.io)
          this.setTooltip(Blockly.Msg['U_INPUT_TOOLTIP'] || '讀取輸入')
        },
        plus_: function (this: any) {
          const idx = this.argCount_
          this.argSlots_[idx] = { mode: 'select', selectedVar: 'v' + idx }
          buildArgSlot(this, idx, 'select', {
            getVarOptions: () => self.getWorkspaceVarOptions(),
            defaultVar: 'v' + idx,
          })
          this.moveInputBefore(`ARG_${idx}`, 'TAIL')
          try { this.setFieldValue('v' + idx, `SEL_${idx}`) } catch (_e) { /* ignore */ }
          this.argCount_++
          setMinusState(this, false)
        },
        minus_: function (this: any) {
          if (this.argCount_ <= 1) return
          this.argCount_--
          const idx = this.argCount_
          if (this.getInput(`ARG_${idx}`)) this.removeInput(`ARG_${idx}`)
          this.argSlots_.length = this.argCount_
          setMinusState(this, this.argCount_ <= 1)
        },
        saveExtraState: function (this: any) {
          const args: ArgSlotState[] = []
          for (let i = 0; i < this.argCount_; i++) {
            const slot = this.argSlots_[i]
            if (slot.mode === 'select') {
              const val = this.getFieldValue(`SEL_${i}`)
              args.push({ mode: 'select', text: val })
            } else if (slot.mode === 'custom') {
              args.push({ mode: 'custom', text: this.getFieldValue(`TEXT_${i}`) ?? '' })
            } else {
              args.push({ mode: 'compose' })
            }
          }
          return { args }
        },
        loadExtraState: function (this: any, state: { args?: ArgSlotState[] }) {
          const args = state?.args ?? [{ mode: 'select', text: 'x' }]
          // Remove all existing slots
          for (let i = this.argCount_ - 1; i >= 0; i--) {
            if (this.getInput(`ARG_${i}`)) this.removeInput(`ARG_${i}`)
          }
          this.argCount_ = args.length
          this.argSlots_ = [...args]
          for (let i = 0; i < args.length; i++) {
            const a = args[i]
            buildArgSlot(this, i, a.mode, {
              getVarOptions: () => self.getWorkspaceVarOptions(),
              inputPrefix: i === 0 ? (Blockly.Msg['U_INPUT_LABEL'] || '讀取輸入 →') : undefined,
              defaultVar: a.text ?? 'x',
              customDefault: a.text ?? '',
            })
            this.moveInputBefore(`ARG_${i}`, 'TAIL')
            if (a.mode === 'select' && a.text) {
              try { this.setFieldValue(a.text, `SEL_${i}`) } catch (_e) { /* ignore */ }
            }
          }
          setMinusState(this, this.argCount_ <= 1)
        },
      }
    }

    // c_printf with FORMAT + three-mode multi-arg (args can be 0)
    {
      Blockly.Blocks['c_printf'] = {
        argCount_: 1,
        argSlots_: [{ mode: 'select' }] as ArgSlotState[],
        init: function (this: any) {
          this.argCount_ = 1
          this.argSlots_ = [{ mode: 'select', selectedVar: 'x' }]
          this.appendDummyInput('FORMAT_ROW')
            .appendField(Blockly.Msg['C_PRINTF_FORMAT_LABEL'] || 'printf 格式')
            .appendField(new Blockly.FieldTextInput('%d\\n') as Blockly.Field, 'FORMAT')
          buildArgSlot(this, 0, 'select', {
            getVarOptions: () => self.getWorkspaceVarOptions(),
            inputPrefix: ',',
            separator: ',',
            defaultVar: 'x',
          })
          try { this.setFieldValue('x', 'SEL_0') } catch (_e) { /* ignore */ }
          this.appendDummyInput('TAIL')
            .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plus_()))
            .appendField(new Blockly.FieldImage(MINUS_DISABLED_IMG, 20, 20, '-', () => this.minus_()), 'MINUS_BTN')
          this.setInputsInline(true)
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setColour(CATEGORY_COLORS.io)
          this.setTooltip(Blockly.Msg['C_PRINTF_TOOLTIP'] || 'printf')
        },
        plus_: function (this: any) {
          const idx = this.argCount_
          this.argSlots_[idx] = { mode: 'select', selectedVar: 'x' }
          buildArgSlot(this, idx, 'select', {
            getVarOptions: () => self.getWorkspaceVarOptions(),
            inputPrefix: ',',
            separator: ',',
            defaultVar: 'x',
          })
          this.moveInputBefore(`ARG_${idx}`, 'TAIL')
          try { this.setFieldValue('x', `SEL_${idx}`) } catch (_e) { /* ignore */ }
          this.argCount_++
          setMinusState(this, false)
        },
        minus_: function (this: any) {
          if (this.argCount_ <= 0) return
          this.argCount_--
          if (this.getInput(`ARG_${this.argCount_}`)) this.removeInput(`ARG_${this.argCount_}`)
          this.argSlots_.length = this.argCount_
          setMinusState(this, this.argCount_ <= 0)
        },
        saveExtraState: function (this: any) {
          const args: ArgSlotState[] = []
          for (let i = 0; i < this.argCount_; i++) {
            const slot = this.argSlots_[i]
            if (slot.mode === 'select') {
              args.push({ mode: 'select', text: this.getFieldValue(`SEL_${i}`) })
            } else if (slot.mode === 'custom') {
              args.push({ mode: 'custom', text: this.getFieldValue(`TEXT_${i}`) ?? '' })
            } else {
              args.push({ mode: 'compose' })
            }
          }
          return { args }
        },
        loadExtraState: function (this: any, state: { args?: ArgSlotState[] }) {
          const args = state?.args ?? []
          for (let i = this.argCount_ - 1; i >= 0; i--) {
            if (this.getInput(`ARG_${i}`)) this.removeInput(`ARG_${i}`)
          }
          this.argCount_ = args.length
          this.argSlots_ = [...args]
          for (let i = 0; i < args.length; i++) {
            const a = args[i]
            buildArgSlot(this, i, a.mode, {
              getVarOptions: () => self.getWorkspaceVarOptions(),
              inputPrefix: ',',
              separator: ',',
              defaultVar: a.text ?? 'x',
              customDefault: a.text ?? '',
            })
            this.moveInputBefore(`ARG_${i}`, 'TAIL')
            if (a.mode === 'select' && a.text) {
              try { this.setFieldValue(a.text, `SEL_${i}`) } catch (_e) { /* ignore */ }
            }
          }
          setMinusState(this, this.argCount_ <= 0)
        },
      }
    }

    // Helper: check if a variable is an array (doesn't need &)
    const isArrayVar = (varName: string): boolean => {
      const workspace = self.blocklyPanel?.getWorkspace()
      if (!workspace) return false
      for (const block of workspace.getAllBlocks(false)) {
        if (block.type === 'u_array_declare') {
          if (block.getFieldValue('NAME') === varName) return true
        }
      }
      return false
    }

    // c_scanf with FORMAT + three-mode multi-arg + auto & for select mode
    {
      Blockly.Blocks['c_scanf'] = {
        argCount_: 1,
        argSlots_: [{ mode: 'select' }] as ArgSlotState[],
        init: function (this: any) {
          this.argCount_ = 1
          this.argSlots_ = [{ mode: 'select', selectedVar: 'x' }]
          this.appendDummyInput('FORMAT_ROW')
            .appendField(Blockly.Msg['C_SCANF_FORMAT_LABEL'] || 'scanf 格式')
            .appendField(new Blockly.FieldTextInput('%d') as Blockly.Field, 'FORMAT')
          buildArgSlot(this, 0, 'select', {
            getVarOptions: () => self.getScanfVarOptions(),
            inputPrefix: ',',
            separator: ',',
            defaultVar: 'x',
          })
          try { this.setFieldValue('x', 'SEL_0') } catch (_e) { /* ignore */ }
          this.appendDummyInput('TAIL')
            .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plus_()))
            .appendField(new Blockly.FieldImage(MINUS_DISABLED_IMG, 20, 20, '-', () => this.minus_()), 'MINUS_BTN')
          this.setInputsInline(true)
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setColour(CATEGORY_COLORS.io)
          this.setTooltip(Blockly.Msg['C_SCANF_TOOLTIP'] || 'scanf')
          this.isArrayVar_ = isArrayVar
        },
        plus_: function (this: any) {
          const idx = this.argCount_
          this.argSlots_[idx] = { mode: 'select', selectedVar: 'x' }
          buildArgSlot(this, idx, 'select', {
            getVarOptions: () => self.getScanfVarOptions(),
            inputPrefix: ',',
            separator: ',',
            defaultVar: 'x',
          })
          this.moveInputBefore(`ARG_${idx}`, 'TAIL')
          try { this.setFieldValue('x', `SEL_${idx}`) } catch (_e) { /* ignore */ }
          this.argCount_++
          setMinusState(this, false)
        },
        minus_: function (this: any) {
          if (this.argCount_ <= 0) return
          this.argCount_--
          if (this.getInput(`ARG_${this.argCount_}`)) this.removeInput(`ARG_${this.argCount_}`)
          this.argSlots_.length = this.argCount_
          setMinusState(this, this.argCount_ <= 0)
        },
        saveExtraState: function (this: any) {
          const args: ArgSlotState[] = []
          for (let i = 0; i < this.argCount_; i++) {
            const slot = this.argSlots_[i]
            if (slot.mode === 'select') {
              args.push({ mode: 'select', text: this.getFieldValue(`SEL_${i}`) })
            } else if (slot.mode === 'custom') {
              args.push({ mode: 'custom', text: this.getFieldValue(`TEXT_${i}`) ?? '' })
            } else {
              args.push({ mode: 'compose' })
            }
          }
          return { args }
        },
        loadExtraState: function (this: any, state: { args?: ArgSlotState[] }) {
          const args = state?.args ?? []
          for (let i = this.argCount_ - 1; i >= 0; i--) {
            if (this.getInput(`ARG_${i}`)) this.removeInput(`ARG_${i}`)
          }
          this.argCount_ = args.length
          this.argSlots_ = [...args]
          for (let i = 0; i < args.length; i++) {
            const a = args[i]
            buildArgSlot(this, i, a.mode, {
              getVarOptions: () => self.getScanfVarOptions(),
              inputPrefix: ',',
              separator: ',',
              defaultVar: a.text ?? 'x',
              customDefault: a.text ?? '',
            })
            this.moveInputBefore(`ARG_${i}`, 'TAIL')
            if (a.mode === 'select' && a.text) {
              try { this.setFieldValue(a.text, `SEL_${i}`) } catch (_e) { /* ignore */ }
            }
          }
          setMinusState(this, this.argCount_ <= 0)
        },
      }
    }

    // u_endl
    {
      Blockly.Blocks['u_endl'] = {
        init: function (this: Blockly.Block) {
          this.appendDummyInput()
            .appendField(Blockly.Msg['U_ENDL_MSG0'] || '換行')
          this.setOutput(true, 'Expression')
          this.setColour(CATEGORY_COLORS.io)
          this.setTooltip(Blockly.Msg['U_ENDL_TOOLTIP'] || '換行')
        },
      }
    }

    // u_if — unified progressive block (P4: progressive disclosure)
    // Starts as simple if, +/- adds else-if, mutator gear adds/removes else
    {
      // Mutator helper blocks
      Blockly.Blocks['u_if_container'] = {
        init: function (this: Blockly.Block) {
          this.appendDummyInput().appendField(Blockly.Msg['U_IF_ELSE_IF_LABEL'] || '如果')
          this.appendStatementInput('STACK')
          this.setColour(CATEGORY_COLORS.control)
          this.contextMenu = false
        },
      }
      Blockly.Blocks['u_if_elseif_input'] = {
        init: function (this: Blockly.Block) {
          this.appendDummyInput().appendField(Blockly.Msg['U_IF_ELSE_ELSEIF_MSG'] || '否則，如果')
          this.setPreviousStatement(true)
          this.setNextStatement(true)
          this.setColour(CATEGORY_COLORS.control)
          this.contextMenu = false
        },
      }
      Blockly.Blocks['u_if_else_input'] = {
        init: function (this: Blockly.Block) {
          this.appendDummyInput().appendField(Blockly.Msg['U_IF_ELSE_MSG2'] || '否則')
          this.setPreviousStatement(true)
          this.setColour(CATEGORY_COLORS.control)
          this.contextMenu = false
        },
      }

      Blockly.Blocks['u_if'] = {
        elseifCount_: 0,
        hasElse_: false,
        init: function (this: any) {
          this.elseifCount_ = 0
          this.hasElse_ = false
          this.appendValueInput(IF_INPUTS.value[0])
            .appendField(Blockly.Msg['U_IF_MSG'] || '如果')
          this.appendStatementInput(IF_INPUTS.statement[0])
            .appendField(Blockly.Msg['U_IF_THEN'] || '則')
          this.appendDummyInput('TAIL')
            .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plusElseIf_()))
            .appendField(new Blockly.FieldImage(MINUS_DISABLED_IMG, 20, 20, '-', () => this.minusElseIf_()), 'MINUS_BTN')
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setColour(CATEGORY_COLORS.control)
          this.setTooltip(Blockly.Msg['U_IF_TOOLTIP'] || '條件判斷')
          this.setMutator(new Blockly.icons.MutatorIcon(
            ['u_if_elseif_input', 'u_if_else_input'],
            this as unknown as Blockly.BlockSvg,
          ))
        },
        plusElseIf_: function (this: any) {
          const idx = this.elseifCount_
          this.elseifCount_++
          this.appendValueInput(`ELSEIF_CONDITION_${idx}`)
            .appendField(Blockly.Msg['U_IF_ELSE_ELSEIF_MSG'] || '否則，如果')
          this.appendStatementInput(`ELSEIF_THEN_${idx}`)
            .appendField(Blockly.Msg['U_IF_THEN'] || '則')
          // Move before TAIL (TAIL is always before ELSE)
          this.moveInputBefore(`ELSEIF_CONDITION_${idx}`, 'TAIL')
          this.moveInputBefore(`ELSEIF_THEN_${idx}`, 'TAIL')
          setMinusState(this, false)
        },
        minusElseIf_: function (this: any) {
          if (this.elseifCount_ <= 0) return
          this.elseifCount_--
          const idx = this.elseifCount_
          this.removeInput(`ELSEIF_THEN_${idx}`)
          this.removeInput(`ELSEIF_CONDITION_${idx}`)
          setMinusState(this, this.elseifCount_ <= 0)
        },
        updateShape_: function (this: any) {
          // Remove old else-if inputs
          let i = 0
          while (this.getInput(`ELSEIF_CONDITION_${i}`)) {
            this.removeInput(`ELSEIF_CONDITION_${i}`)
            this.removeInput(`ELSEIF_THEN_${i}`)
            i++
          }
          // Remove ELSE, TAIL
          if (this.getInput('ELSE')) this.removeInput('ELSE')
          if (this.getInput('TAIL')) this.removeInput('TAIL')
          // Re-add else-if inputs
          for (let j = 0; j < this.elseifCount_; j++) {
            this.appendValueInput(`ELSEIF_CONDITION_${j}`)
              .appendField(Blockly.Msg['U_IF_ELSE_ELSEIF_MSG'] || '否則，如果')
            this.appendStatementInput(`ELSEIF_THEN_${j}`)
              .appendField(Blockly.Msg['U_IF_THEN'] || '則')
          }
          // Re-add TAIL (with +/- for else-if)
          this.appendDummyInput('TAIL')
            .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plusElseIf_()))
            .appendField(new Blockly.FieldImage(
              this.elseifCount_ <= 0 ? MINUS_DISABLED_IMG : MINUS_IMG,
              20, 20, '-', () => this.minusElseIf_()), 'MINUS_BTN')
          // Re-add ELSE if needed
          if (this.hasElse_) {
            this.appendStatementInput('ELSE')
              .appendField(Blockly.Msg['U_IF_ELSE_MSG2'] || '否則')
          }
        },
        saveExtraState: function (this: any) {
          if (this.elseifCount_ === 0 && !this.hasElse_) return null
          const state: Record<string, unknown> = {}
          if (this.elseifCount_ > 0) state.elseifCount = this.elseifCount_
          if (this.hasElse_) state.hasElse = true
          return state
        },
        loadExtraState: function (this: any, state: Record<string, unknown>) {
          this.elseifCount_ = (state?.elseifCount as number) ?? 0
          this.hasElse_ = state?.hasElse === true
          this.updateShape_()
        },
        decompose: function (this: any, workspace: Blockly.WorkspaceSvg) {
          const containerBlock = workspace.newBlock('u_if_container')
          containerBlock.initSvg()
          let connection = containerBlock.getInput('STACK')!.connection!
          for (let i = 0; i < this.elseifCount_; i++) {
            const elseifBlock = workspace.newBlock('u_if_elseif_input')
            elseifBlock.initSvg()
            connection.connect(elseifBlock.previousConnection!)
            connection = elseifBlock.nextConnection!
          }
          if (this.hasElse_) {
            const elseBlock = workspace.newBlock('u_if_else_input')
            elseBlock.initSvg()
            connection.connect(elseBlock.previousConnection!)
          }
          return containerBlock
        },
        compose: function (this: any, containerBlock: Blockly.Block) {
          let elseifCount = 0
          let hasElse = false
          let clauseBlock = containerBlock.getInputTargetBlock('STACK')
          while (clauseBlock) {
            if (clauseBlock.type === 'u_if_elseif_input') {
              elseifCount++
            } else if (clauseBlock.type === 'u_if_else_input') {
              hasElse = true
            }
            clauseBlock = clauseBlock.getNextBlock()
          }
          this.elseifCount_ = elseifCount
          this.hasElse_ = hasElse
          this.updateShape_()
        },
      }

      // Keep u_if_else as alias — loads old saved state and converts to u_if
      Blockly.Blocks['u_if_else'] = Blockly.Blocks['u_if']
    }
    /* eslint-enable @typescript-eslint/no-explicit-any */

    // u_while_loop
    {
      Blockly.Blocks['u_while_loop'] = {
        init: function (this: Blockly.Block) {
          this.appendValueInput(WHILE_INPUTS.value[0])
            .appendField(Blockly.Msg['U_WHILE_MSG'] || '當')
          this.appendStatementInput(WHILE_INPUTS.statement[0])
            .appendField(Blockly.Msg['U_WHILE_DO'] || '重複')
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setColour(CATEGORY_COLORS.control)
          this.setTooltip(Blockly.Msg['U_WHILE_TOOLTIP'] || '當條件成立時持續執行')
        },
      }
    }

    // u_count_loop
    {
      Blockly.Blocks['u_count_loop'] = {
        init: function (this: Blockly.Block) {
          this.appendDummyInput()
            .appendField(Blockly.Msg['U_COUNT_LOOP_MSG'] || '計數')
            .appendField(new Blockly.FieldTextInput('i') as Blockly.Field, 'VAR')
          this.appendValueInput(COUNT_LOOP_INPUTS.value[0])
            .appendField(Blockly.Msg['U_COUNT_LOOP_FROM'] || '從')
          this.appendValueInput(COUNT_LOOP_INPUTS.value[1])
            .appendField(new Blockly.FieldDropdown([
              [Blockly.Msg['U_COUNT_LOOP_TO_EXCL'] || '到（不含）', 'FALSE'],
              [Blockly.Msg['U_COUNT_LOOP_TO_INCL'] || '到（含）', 'TRUE'],
            ]) as Blockly.Field, 'BOUND')
          this.appendStatementInput(COUNT_LOOP_INPUTS.statement[0])
            .appendField(Blockly.Msg['U_COUNT_LOOP_DO'] || '重複')
          this.setInputsInline(true)
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setColour(CATEGORY_COLORS.control)
          this.setTooltip(Blockly.Msg['U_COUNT_LOOP_TOOLTIP'] || '讓程式重複執行：變數會從起始值一直數到結束值，每次加 1')
        },
      }
    }

    // u_break, u_continue
    {
      Blockly.Blocks['u_break'] = {
        init: function (this: Blockly.Block) {
          this.appendDummyInput().appendField(Blockly.Msg['U_BREAK_MSG'] || '跳出迴圈')
          this.setPreviousStatement(true, 'Statement')
          this.setColour(CATEGORY_COLORS.control)
          this.setTooltip(Blockly.Msg['U_BREAK_TOOLTIP'] || '立刻停止迴圈，不再重複')
        },
      }
    }
    {
      Blockly.Blocks['u_continue'] = {
        init: function (this: Blockly.Block) {
          this.appendDummyInput().appendField(Blockly.Msg['U_CONTINUE_MSG'] || '跳至下一次')
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setColour(CATEGORY_COLORS.control)
          this.setTooltip(Blockly.Msg['U_CONTINUE_TOOLTIP'] || '跳過本次迴圈，直接執行下一次')
        },
      }
    }

    // Shared type options for func_def and forward_decl
    const getParamTypeOptions = (currentVal?: string): Array<[string, string]> => {
      const opts: Array<[string, string]> = [
        [Blockly.Msg['U_FUNC_DEF_PARAM_TYPE_INT'] || 'int', 'int'],
        [Blockly.Msg['U_FUNC_DEF_PARAM_TYPE_FLOAT'] || 'float', 'float'],
        [Blockly.Msg['U_FUNC_DEF_PARAM_TYPE_DOUBLE'] || 'double', 'double'],
        [Blockly.Msg['U_FUNC_DEF_PARAM_TYPE_CHAR'] || 'char', 'char'],
        [Blockly.Msg['U_FUNC_DEF_PARAM_TYPE_BOOL'] || 'bool', 'bool'],
        [Blockly.Msg['U_FUNC_DEF_PARAM_TYPE_STRING'] || 'string', 'string'],
        ['int*', 'int*'],
        ['char*', 'char*'],
        ['double*', 'double*'],
        ['void*', 'void*'],
      ]
      if (currentVal && !opts.some(o => o[1] === currentVal)) {
        opts.unshift([currentVal, currentVal])
      }
      return opts
    }

    const getReturnTypeOptions = (): Array<[string, string]> => [
      [Blockly.Msg['U_FUNC_DEF_RETURN_TYPE_VOID'] || 'void', 'void'],
      [Blockly.Msg['U_FUNC_DEF_RETURN_TYPE_INT'] || 'int', 'int'],
      [Blockly.Msg['U_FUNC_DEF_RETURN_TYPE_FLOAT'] || 'float', 'float'],
      [Blockly.Msg['U_FUNC_DEF_RETURN_TYPE_DOUBLE'] || 'double', 'double'],
      [Blockly.Msg['U_FUNC_DEF_RETURN_TYPE_CHAR'] || 'char', 'char'],
      [Blockly.Msg['U_FUNC_DEF_RETURN_TYPE_BOOL'] || 'bool', 'bool'],
      [Blockly.Msg['U_FUNC_DEF_RETURN_TYPE_LONG_LONG'] || 'long long', 'long long'],
      [Blockly.Msg['U_FUNC_DEF_RETURN_TYPE_STRING'] || 'string', 'string'],
    ]

    // u_func_def with +/- for parameters
    /* eslint-disable @typescript-eslint/no-explicit-any */
    {
      Blockly.Blocks['u_func_def'] = {
        paramCount_: 0,
        init: function (this: any) {
          this.paramCount_ = 0
          this.appendDummyInput('HEADER')
            .appendField(Blockly.Msg['U_FUNC_DEF_LABEL'] || '定義函式')
            .appendField(Blockly.Msg['U_FUNC_DEF_RETURN_LABEL'] || '回傳型別')
            .appendField(self.createOpenDropdown(getReturnTypeOptions) as Blockly.Field, 'RETURN_TYPE')
            .appendField(new Blockly.FieldTextInput('main') as Blockly.Field, 'NAME')
          // Start with no parens (0 params) — just +/- buttons
          this.appendDummyInput('PARAMS_LABEL')
          this.appendDummyInput('PARAMS_END')
            .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plusParam_()))
            .appendField(new Blockly.FieldImage(MINUS_DISABLED_IMG, 20, 20, '-', () => this.minusParam_()), 'MINUS_BTN')
          this.appendStatementInput('BODY')
          this.setInputsInline(true)
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setColour(CATEGORY_COLORS.functions)
          this.setTooltip(Blockly.Msg['U_FUNC_DEF_TOOLTIP'] || '定義函式')
        },
        rebuildParamLabels_: function (this: any) {
          // Remove and recreate PARAMS_LABEL and PARAMS_END with correct labels
          // Save +/- button state
          const wasAtMin = this.paramCount_ <= 0
          // Remove old
          if (this.getInput('PARAMS_LABEL')) this.removeInput('PARAMS_LABEL')
          if (this.getInput('PARAMS_END')) this.removeInput('PARAMS_END')
          // Recreate
          if (this.paramCount_ > 0) {
            this.appendDummyInput('PARAMS_LABEL')
              .appendField(Blockly.Msg['U_FUNC_DEF_PARAMS_OPEN'] || '（參數')
            // Move PARAMS_LABEL before first param
            this.moveInputBefore('PARAMS_LABEL', 'PARAM_0')
          } else {
            this.appendDummyInput('PARAMS_LABEL')
          }
          if (this.paramCount_ > 0) {
            this.appendDummyInput('PARAMS_END')
              .appendField(Blockly.Msg['U_FUNC_DEF_PARAMS_CLOSE'] || '）')
              .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plusParam_()))
              .appendField(new Blockly.FieldImage(wasAtMin ? MINUS_DISABLED_IMG : MINUS_IMG, 20, 20, '-', () => this.minusParam_()), 'MINUS_BTN')
          } else {
            this.appendDummyInput('PARAMS_END')
              .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plusParam_()))
              .appendField(new Blockly.FieldImage(MINUS_DISABLED_IMG, 20, 20, '-', () => this.minusParam_()), 'MINUS_BTN')
          }
          // Move PARAMS_END before BODY
          this.moveInputBefore('PARAMS_END', 'BODY')
        },
        plusParam_: function (this: any) {
          const idx = this.paramCount_
          const input = this.appendDummyInput(`PARAM_${idx}`)
          if (idx > 0) input.appendField(',')
          input.appendField(self.createOpenDropdown(getParamTypeOptions) as Blockly.Field, `TYPE_${idx}`)
          input.appendField(new Blockly.FieldTextInput(`p${idx}`) as Blockly.Field, `PARAM_${idx}`)
          this.moveInputBefore(`PARAM_${idx}`, 'PARAMS_END')
          this.paramCount_++
          // Rebuild labels when transitioning from 0 to 1
          if (this.paramCount_ === 1) {
            this.rebuildParamLabels_()
          }
          setMinusState(this, false)
        },
        minusParam_: function (this: any) {
          if (this.paramCount_ <= 0) return
          this.paramCount_--
          this.removeInput(`PARAM_${this.paramCount_}`)
          // Rebuild labels when transitioning from 1 to 0
          if (this.paramCount_ === 0) {
            this.rebuildParamLabels_()
          }
          setMinusState(this, this.paramCount_ <= 0)
        },
        saveExtraState: function (this: any) {
          if (this.paramCount_ > 0) {
            return { paramCount: this.paramCount_ }
          }
          return null
        },
        loadExtraState: function (this: any, state: { paramCount?: number }) {
          const count = state?.paramCount ?? 0
          while (this.paramCount_ < count) {
            this.plusParam_()
          }
        },
      }
    }

    // u_func_call with +/- for arguments
    {
      Blockly.Blocks['u_func_call'] = {
        argCount_: 0,
        init: function (this: any) {
          const block = this
          this.argCount_ = 0
          this.appendDummyInput('LABEL')
            .appendField(Blockly.Msg['U_FUNC_CALL_LABEL'] || '呼叫函式')
            .appendField(self.createOpenDropdown(() => self.getWorkspaceFuncOptions()) as Blockly.Field, 'NAME')
          this.appendDummyInput('TAIL')
            .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plusArg_()))
            .appendField(new Blockly.FieldImage(MINUS_DISABLED_IMG, 20, 20, '-', () => this.minusArg_()), 'MINUS_BTN')
          this.setInputsInline(true)
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setColour(CATEGORY_COLORS.functions)
          this.setTooltip(Blockly.Msg['U_FUNC_CALL_TOOLTIP'] || '呼叫函式')
        },
        rebuildArgLabels_: function (this: any) {
          if (this.getInput('LABEL')) this.removeInput('LABEL')
          if (this.getInput('TAIL')) this.removeInput('TAIL')
          if (this.argCount_ > 0) {
            this.appendDummyInput('LABEL')
              .appendField(Blockly.Msg['U_FUNC_CALL_LABEL'] || '呼叫函式')
              .appendField(self.createOpenDropdown(() => self.getWorkspaceFuncOptions(this.getFieldValue('NAME'))) as Blockly.Field, 'NAME')
              .appendField(Blockly.Msg['U_FUNC_CALL_OPEN'] || '（')
            this.appendDummyInput('TAIL')
              .appendField(Blockly.Msg['U_FUNC_CALL_CLOSE'] || '）')
              .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plusArg_()))
              .appendField(new Blockly.FieldImage(MINUS_IMG, 20, 20, '-', () => this.minusArg_()), 'MINUS_BTN')
          } else {
            this.appendDummyInput('LABEL')
              .appendField(Blockly.Msg['U_FUNC_CALL_LABEL'] || '呼叫函式')
              .appendField(self.createOpenDropdown(() => self.getWorkspaceFuncOptions(this.getFieldValue('NAME'))) as Blockly.Field, 'NAME')
            this.appendDummyInput('TAIL')
              .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plusArg_()))
              .appendField(new Blockly.FieldImage(MINUS_DISABLED_IMG, 20, 20, '-', () => this.minusArg_()), 'MINUS_BTN')
          }
          this.moveInputBefore('LABEL', 'ARG_0')
        },
        plusArg_: function (this: any) {
          const idx = this.argCount_
          const savedName = this.getFieldValue('NAME') || 'myFunction'
          this.appendValueInput(`ARG_${idx}`)
            .appendField(idx > 0 ? ',' : '')
          this.moveInputBefore(`ARG_${idx}`, 'TAIL')
          this.argCount_++
          if (this.argCount_ === 1) {
            this.rebuildArgLabels_()
            this.setFieldValue(savedName, 'NAME')
          }
          setMinusState(this, false)
        },
        minusArg_: function (this: any) {
          if (this.argCount_ <= 0) return
          const savedName = this.getFieldValue('NAME') || 'myFunction'
          this.argCount_--
          this.removeInput(`ARG_${this.argCount_}`)
          if (this.argCount_ === 0) {
            this.rebuildArgLabels_()
            this.setFieldValue(savedName, 'NAME')
          }
          setMinusState(this, this.argCount_ <= 0)
        },
        saveExtraState: function (this: any) {
          if (this.argCount_ > 0) return { argCount: this.argCount_ }
          return null
        },
        loadExtraState: function (this: any, state: { argCount?: number }) {
          const count = state?.argCount ?? 0
          while (this.argCount_ < count) {
            this.plusArg_()
          }
        },
      }
    }

    // u_func_call_expr — expression version with +/- for arguments
    {
      Blockly.Blocks['u_func_call_expr'] = {
        argCount_: 0,
        init: function (this: any) {
          this.argCount_ = 0
          this.appendDummyInput('LABEL')
            .appendField(Blockly.Msg['U_FUNC_CALL_LABEL'] || '呼叫函式')
            .appendField(self.createOpenDropdown(() => self.getWorkspaceFuncOptions()) as Blockly.Field, 'NAME')
          this.appendDummyInput('TAIL')
            .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plusArg_()))
            .appendField(new Blockly.FieldImage(MINUS_DISABLED_IMG, 20, 20, '-', () => this.minusArg_()), 'MINUS_BTN')
          this.setInputsInline(true)
          this.setOutput(true, 'Expression')
          this.setColour(CATEGORY_COLORS.functions)
          this.setTooltip(Blockly.Msg['U_FUNC_CALL_EXPR_TOOLTIP'] || '呼叫函式（回傳值）')
        },
        rebuildArgLabels_: function (this: any) {
          if (this.getInput('LABEL')) this.removeInput('LABEL')
          if (this.getInput('TAIL')) this.removeInput('TAIL')
          if (this.argCount_ > 0) {
            this.appendDummyInput('LABEL')
              .appendField(Blockly.Msg['U_FUNC_CALL_LABEL'] || '呼叫函式')
              .appendField(self.createOpenDropdown(() => self.getWorkspaceFuncOptions(this.getFieldValue('NAME'))) as Blockly.Field, 'NAME')
              .appendField(Blockly.Msg['U_FUNC_CALL_OPEN'] || '（')
            this.appendDummyInput('TAIL')
              .appendField(Blockly.Msg['U_FUNC_CALL_CLOSE'] || '）')
              .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plusArg_()))
              .appendField(new Blockly.FieldImage(MINUS_IMG, 20, 20, '-', () => this.minusArg_()), 'MINUS_BTN')
          } else {
            this.appendDummyInput('LABEL')
              .appendField(Blockly.Msg['U_FUNC_CALL_LABEL'] || '呼叫函式')
              .appendField(self.createOpenDropdown(() => self.getWorkspaceFuncOptions(this.getFieldValue('NAME'))) as Blockly.Field, 'NAME')
            this.appendDummyInput('TAIL')
              .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plusArg_()))
              .appendField(new Blockly.FieldImage(MINUS_DISABLED_IMG, 20, 20, '-', () => this.minusArg_()), 'MINUS_BTN')
          }
          this.moveInputBefore('LABEL', 'ARG_0')
        },
        plusArg_: function (this: any) {
          const idx = this.argCount_
          const savedName = this.getFieldValue('NAME') || 'myFunction'
          this.appendValueInput(`ARG_${idx}`)
            .appendField(idx > 0 ? ',' : '')
          this.moveInputBefore(`ARG_${idx}`, 'TAIL')
          this.argCount_++
          if (this.argCount_ === 1) {
            this.rebuildArgLabels_()
            this.setFieldValue(savedName, 'NAME')
          }
          setMinusState(this, false)
        },
        minusArg_: function (this: any) {
          if (this.argCount_ <= 0) return
          const savedName = this.getFieldValue('NAME') || 'myFunction'
          this.argCount_--
          this.removeInput(`ARG_${this.argCount_}`)
          if (this.argCount_ === 0) {
            this.rebuildArgLabels_()
            this.setFieldValue(savedName, 'NAME')
          }
          setMinusState(this, this.argCount_ <= 0)
        },
        saveExtraState: function (this: any) {
          if (this.argCount_ > 0) return { argCount: this.argCount_ }
          return null
        },
        loadExtraState: function (this: any, state: { argCount?: number }) {
          const count = state?.argCount ?? 0
          while (this.argCount_ < count) {
            this.plusArg_()
          }
        },
      }
    }
    /* eslint-enable @typescript-eslint/no-explicit-any */

    // u_return
    {
      Blockly.Blocks['u_return'] = {
        init: function (this: Blockly.Block) {
          this.appendValueInput('VALUE')
            .appendField(Blockly.Msg['U_RETURN_MSG'] || '回傳')
          this.setPreviousStatement(true, 'Statement')
          this.setColour(CATEGORY_COLORS.functions)
          this.setTooltip(Blockly.Msg['U_RETURN_TOOLTIP'] || '回傳值')
        },
      }
    }

    // u_var_ref with dynamic dropdown from workspace declarations
    {
      Blockly.Blocks['u_var_ref'] = {
        init: function (this: Blockly.Block) {
          this.appendDummyInput()
            .appendField(Blockly.Msg['U_VAR_REF_LABEL'] || '變數')
            .appendField(self.createOpenDropdown(() => self.getWorkspaceVarOptions()) as Blockly.Field, 'NAME')
          this.setOutput(true, 'Expression')
          this.setColour(CATEGORY_COLORS.data)
          this.setTooltip(Blockly.Msg['U_VAR_REF_TOOLTIP'] || '使用變數的值')
        },
      }
    }

    // u_array_declare — SIZE as input_value (allows expressions)
    {
      Blockly.Blocks['u_array_declare'] = {
        init: function (this: Blockly.Block) {
          const getArrayTypeOptions = (): Array<[string, string]> => [
            [Blockly.Msg['U_ARRAY_DECLARE_TYPE_INT'] || 'int', 'int'],
            [Blockly.Msg['U_ARRAY_DECLARE_TYPE_FLOAT'] || 'float', 'float'],
            [Blockly.Msg['U_ARRAY_DECLARE_TYPE_DOUBLE'] || 'double', 'double'],
            [Blockly.Msg['U_ARRAY_DECLARE_TYPE_CHAR'] || 'char', 'char'],
            [Blockly.Msg['U_ARRAY_DECLARE_TYPE_BOOL'] || 'bool', 'bool'],
            [Blockly.Msg['U_ARRAY_DECLARE_TYPE_LONG_LONG'] || 'long long', 'long long'],
          ]
          this.appendDummyInput()
            .appendField(Blockly.Msg['U_ARRAY_DECLARE_CREATE_LABEL'] || '建立')
            .appendField(self.createOpenDropdown(getArrayTypeOptions) as Blockly.Field, 'TYPE')
            .appendField(Blockly.Msg['U_ARRAY_DECLARE_ARRAY_LABEL'] || '陣列')
            .appendField(self.createOpenDropdown(() => self.getWorkspaceArrayOptions()) as Blockly.Field, 'NAME')
          this.appendValueInput('SIZE')
            .appendField(Blockly.Msg['U_ARRAY_DECLARE_SIZE_LABEL'] || '長度')
            .setCheck('Expression')
          this.setInputsInline(true)
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setColour(CATEGORY_COLORS.arrays)
          this.setTooltip(Blockly.Msg['U_ARRAY_DECLARE_TOOLTIP'] || '宣告陣列')
        },
      }
    }

    // c_raw_code — with unresolved visual distinction
    {
      Blockly.Blocks['c_raw_code'] = {
        init: function (this: Blockly.Block) {
          this.appendDummyInput()
            .appendField(Blockly.Msg['C_RAW_CODE_LABEL'] || '直接寫程式碼：')
            .appendField(new Blockly.FieldTextInput('') as Blockly.Field, 'CODE')
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setColour(CATEGORY_COLORS.cpp_special)
          this.setTooltip(Blockly.Msg['C_RAW_CODE_TOOLTIP'] || '直接輸入程式碼')
        },
        saveExtraState: function (this: Blockly.Block & { unresolved_?: boolean; nodeType_?: string }) {
          const state: Record<string, unknown> = {}
          if (this.unresolved_) {
            state.unresolved = true
            state.nodeType = this.nodeType_ ?? ''
          }
          return state
        },
        loadExtraState: function (this: Blockly.Block & { unresolved_?: boolean; nodeType_?: string }, state: Record<string, unknown>) {
          if (state.unresolved) {
            this.unresolved_ = true
            this.nodeType_ = (state.nodeType as string) ?? ''
            this.setColour(CATEGORY_COLORS.cpp_special)
            const unresolvedTip = (Blockly.Msg['U_UNRESOLVED_TOOLTIP'] || 'Unresolved: %1').replace('%1', this.nodeType_)
            this.setTooltip(unresolvedTip)
          }
          // 套用降級視覺
          const cause = state.degradationCause as string | undefined
          if (cause && DEGRADATION_VISUALS[cause as keyof typeof DEGRADATION_VISUALS]) {
            const visual = DEGRADATION_VISUALS[cause as keyof typeof DEGRADATION_VISUALS]
            if (visual.colour) this.setColour(visual.colour)
            const tooltipText = (Blockly.Msg as Record<string, string>)[visual.tooltipKey]
            if (tooltipText) this.setTooltip(tooltipText)
          }
        },
      }
    }

    // u_array_access
    {
      Blockly.Blocks['u_array_access'] = {
        init: function (this: Blockly.Block) {
          this.appendValueInput('INDEX')
            .appendField(Blockly.Msg['U_ARRAY_ACCESS_ARRAY_LABEL'] || '陣列')
            .appendField(self.createOpenDropdown(() => self.getWorkspaceArrayOptions()) as Blockly.Field, 'NAME')
            .appendField(Blockly.Msg['U_ARRAY_ACCESS_AT_LABEL'] || '的第 [')
          this.appendDummyInput()
            .appendField(Blockly.Msg['U_ARRAY_ACCESS_END_LABEL'] || '] 格')
          this.setInputsInline(true)
          this.setOutput(true, 'Expression')
          this.setColour(CATEGORY_COLORS.arrays)
          this.setTooltip(Blockly.Msg['U_ARRAY_ACCESS_TOOLTIP'] || '陣列存取')
        },
      }
    }

    // u_array_assign
    {
      Blockly.Blocks['u_array_assign'] = {
        init: function (this: Blockly.Block) {
          this.appendValueInput('INDEX')
            .appendField(Blockly.Msg['U_ARRAY_ASSIGN_SET_LABEL'] || '設定 陣列')
            .appendField(self.createOpenDropdown(() => self.getWorkspaceArrayOptions()) as Blockly.Field, 'NAME')
            .appendField(Blockly.Msg['U_ARRAY_ACCESS_AT_LABEL'] || '的第 [')
          this.appendValueInput('VALUE')
            .appendField(Blockly.Msg['U_ARRAY_ACCESS_END_LABEL'] || '] 格')
            .appendField('←')
          this.setInputsInline(true)
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setColour(CATEGORY_COLORS.arrays)
          this.setTooltip(Blockly.Msg['U_ARRAY_ASSIGN_TOOLTIP'] || '陣列元素賦值')
        },
      }
    }

    // u_var_assign — override JSON to use variable dropdown
    {
      Blockly.Blocks['u_var_assign'] = {
        init: function (this: Blockly.Block) {
          this.appendValueInput('VALUE')
            .appendField(Blockly.Msg['U_VAR_ASSIGN_LABEL'] || '把變數')
            .appendField(self.createOpenDropdown(() => self.getWorkspaceVarOptions()) as Blockly.Field, 'NAME')
            .appendField(Blockly.Msg['U_VAR_ASSIGN_SET_LABEL'] || '設成')
          this.setInputsInline(true)
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setColour(CATEGORY_COLORS.data)
          this.setTooltip(Blockly.Msg['U_VAR_ASSIGN_TOOLTIP'] || '變數賦值')
        },
      }
    }

    // c_increment — override JSON to use variable dropdown
    {
      Blockly.Blocks['c_increment'] = {
        init: function (this: Blockly.Block) {
          this.appendDummyInput()
            .appendField(Blockly.Msg['C_INCREMENT_VAR_LABEL'] || '變數')
            .appendField(new Blockly.FieldDropdown(() => self.getWorkspaceVarOptions()) as Blockly.Field, 'NAME')
            .appendField(new Blockly.FieldDropdown([
              [Blockly.Msg['C_INCREMENT_OP_INCREMENT'] || '加 1（++）', '++'],
              [Blockly.Msg['C_INCREMENT_OP_DECREMENT'] || '減 1（--）', '--'],
            ]) as Blockly.Field, 'OP')
            .appendField(new Blockly.FieldDropdown([
              [Blockly.Msg['C_INCREMENT_POS_POSTFIX'] || '後置', 'postfix'],
              [Blockly.Msg['C_INCREMENT_POS_PREFIX'] || '前置', 'prefix'],
            ]) as Blockly.Field, 'POSITION')
          this.setPreviousStatement(true, null)
          this.setNextStatement(true, null)
          this.setColour(CATEGORY_COLORS.operators)
          this.setTooltip(Blockly.Msg['C_INCREMENT_TOOLTIP'] || '讓變數的值加 1 或減 1')
        },
      }
    }

    // c_compound_assign — override JSON to use variable dropdown
    {
      Blockly.Blocks['c_compound_assign'] = {
        init: function (this: Blockly.Block) {
          this.appendValueInput('VALUE')
            .setCheck('Expression')
            .appendField(Blockly.Msg['C_COMPOUND_ASSIGN_VAR_LABEL'] || '把變數')
            .appendField(new Blockly.FieldDropdown(() => self.getWorkspaceVarOptions()) as Blockly.Field, 'NAME')
            .appendField(new Blockly.FieldDropdown([
              [Blockly.Msg['C_COMPOUND_ASSIGN_OP_PLUS_EQ'] || '加上（+=）', '+='],
              [Blockly.Msg['C_COMPOUND_ASSIGN_OP_MINUS_EQ'] || '減去（-=）', '-='],
              [Blockly.Msg['C_COMPOUND_ASSIGN_OP_TIMES_EQ'] || '乘以（*=）', '*='],
              [Blockly.Msg['C_COMPOUND_ASSIGN_OP_DIVIDE_EQ'] || '除以（/=）', '/='],
              [Blockly.Msg['C_COMPOUND_ASSIGN_OP_REMAINDER_EQ'] || '取餘數（%=）', '%='],
            ]) as Blockly.Field, 'OP')
          this.setInputsInline(true)
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setColour(CATEGORY_COLORS.operators)
          this.setTooltip(Blockly.Msg['C_COMPOUND_ASSIGN_TOOLTIP'] || '把變數的值加上、減去、乘以、除以或取餘數後存回去')
        },
      }
    }

    // c_forward_decl — structured forward declaration with return type, name, +/- typed params
    {
      Blockly.Blocks['c_forward_decl'] = {
        paramCount_: 0,
        init: function (this: any) {
          this.paramCount_ = 0
          this.appendDummyInput('HEADER')
            .appendField(Blockly.Msg['C_FORWARD_DECL_LABEL'] || '函式宣告')
            .appendField(self.createOpenDropdown(getReturnTypeOptions) as Blockly.Field, 'RETURN_TYPE')
            .appendField(new Blockly.FieldTextInput('f') as Blockly.Field, 'NAME')
          this.appendDummyInput('PARAMS_LABEL')
          this.appendDummyInput('PARAMS_END')
            .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plusParam_()))
            .appendField(new Blockly.FieldImage(MINUS_DISABLED_IMG, 20, 20, '-', () => this.minusParam_()), 'MINUS_BTN')
          this.setInputsInline(true)
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setColour(CATEGORY_COLORS.functions)
          this.setTooltip(Blockly.Msg['C_FORWARD_DECL_TOOLTIP'] || '函式前向宣告')
        },
        rebuildParamLabels_: function (this: any) {
          if (this.getInput('PARAMS_LABEL')) this.removeInput('PARAMS_LABEL')
          if (this.getInput('PARAMS_END')) this.removeInput('PARAMS_END')
          if (this.paramCount_ > 0) {
            this.appendDummyInput('PARAMS_LABEL')
              .appendField('(')
            this.moveInputBefore('PARAMS_LABEL', 'PARAM_0')
            this.appendDummyInput('PARAMS_END')
              .appendField(')')
              .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plusParam_()))
              .appendField(new Blockly.FieldImage(this.paramCount_ <= 0 ? MINUS_DISABLED_IMG : MINUS_IMG, 20, 20, '-', () => this.minusParam_()), 'MINUS_BTN')
          } else {
            this.appendDummyInput('PARAMS_LABEL')
            this.appendDummyInput('PARAMS_END')
              .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plusParam_()))
              .appendField(new Blockly.FieldImage(MINUS_DISABLED_IMG, 20, 20, '-', () => this.minusParam_()), 'MINUS_BTN')
          }
        },
        plusParam_: function (this: any) {
          const idx = this.paramCount_
          const input = this.appendDummyInput(`PARAM_${idx}`)
          if (idx > 0) input.appendField(',')
          input.appendField(self.createOpenDropdown(getParamTypeOptions) as Blockly.Field, `TYPE_${idx}`)
          this.moveInputBefore(`PARAM_${idx}`, 'PARAMS_END')
          this.paramCount_++
          if (this.paramCount_ === 1) this.rebuildParamLabels_()
          setMinusState(this, false)
        },
        minusParam_: function (this: any) {
          if (this.paramCount_ <= 0) return
          this.paramCount_--
          this.removeInput(`PARAM_${this.paramCount_}`)
          if (this.paramCount_ === 0) this.rebuildParamLabels_()
          setMinusState(this, this.paramCount_ <= 0)
        },
        saveExtraState: function (this: any) {
          if (this.paramCount_ > 0) return { paramCount: this.paramCount_ }
          return null
        },
        loadExtraState: function (this: any, state: { paramCount?: number }) {
          const count = state?.paramCount ?? 0
          while (this.paramCount_ < count) {
            this.plusParam_()
          }
        },
      }
    }

    // c_comment_line
    {
      Blockly.Blocks['c_comment_line'] = {
        init: function (this: Blockly.Block) {
          this.appendDummyInput()
            .appendField(Blockly.Msg['C_COMMENT_LINE_LABEL'] || '註解：')
            .appendField(new Blockly.FieldTextInput('comment') as Blockly.Field, 'TEXT')
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setColour(CATEGORY_COLORS.cpp_special)
          this.setTooltip(Blockly.Msg['C_COMMENT_LINE_TOOLTIP'] || '註解說明')
        },
      }
    }

    // c_comment_block (multi-line comment)
    {
      Blockly.Blocks['c_comment_block'] = {
        init: function (this: Blockly.Block) {
          this.appendDummyInput()
            .appendField(Blockly.Msg['C_COMMENT_BLOCK_LABEL'] || '多行註解：')
            .appendField(new FieldMultilineInput('comment') as Blockly.Field, 'TEXT')
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setColour(CATEGORY_COLORS.cpp_special)
          this.setTooltip(Blockly.Msg['C_COMMENT_BLOCK_TOOLTIP'] || '多行註解說明')
        },
      }
    }

    // c_comment_doc (Doxygen/JSDoc comment with mutator for @param / @return)
    {
      // Mutator sub-blocks
      Blockly.Blocks['c_doc_container'] = {
        init: function (this: Blockly.Block) {
          this.appendDummyInput().appendField('文件註解')
          this.appendStatementInput('STACK')
          this.setColour('#888888')
          this.contextMenu = false
        },
      }
      Blockly.Blocks['c_doc_param_input'] = {
        init: function (this: Blockly.Block) {
          this.appendDummyInput().appendField('參數')
          this.setPreviousStatement(true)
          this.setNextStatement(true)
          this.setColour('#888888')
          this.contextMenu = false
        },
      }
      Blockly.Blocks['c_doc_return_input'] = {
        init: function (this: Blockly.Block) {
          this.appendDummyInput().appendField('回傳')
          this.setPreviousStatement(true)
          this.setColour('#888888')
          this.contextMenu = false
        },
      }

      Blockly.Blocks['c_comment_doc'] = {
        paramCount_: 0,
        hasReturn_: false,
        init: function (this: any) {
          this.paramCount_ = 0
          this.hasReturn_ = false
          this.appendDummyInput()
            .appendField(Blockly.Msg['C_COMMENT_DOC_LABEL'] || '文件註解')
          this.appendDummyInput('BRIEF_ROW')
            .appendField(Blockly.Msg['C_COMMENT_DOC_BRIEF'] || '說明')
            .appendField(new FieldMultilineInput('') as Blockly.Field, 'BRIEF')
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setColour('#888888')
          this.setTooltip(Blockly.Msg['C_COMMENT_DOC_TOOLTIP'] || '為函式加上文件註解，說明用途、參數和回傳值')
          this.setMutator(new Blockly.icons.MutatorIcon(
            ['c_doc_param_input', 'c_doc_return_input'],
            this as unknown as Blockly.BlockSvg,
          ))
        },
        updateShape_: function (this: any) {
          // Remove old param rows and return row
          let i = 0
          while (this.getInput(`PARAM_${i}`)) {
            this.removeInput(`PARAM_${i}`)
            i++
          }
          if (this.getInput('RETURN_ROW')) this.removeInput('RETURN_ROW')
          // Re-add param rows
          for (let j = 0; j < this.paramCount_; j++) {
            this.appendDummyInput(`PARAM_${j}`)
              .appendField(Blockly.Msg['C_COMMENT_DOC_PARAM'] || '參數')
              .appendField(new Blockly.FieldTextInput('') as Blockly.Field, `PARAM_NAME_${j}`)
              .appendField(new Blockly.FieldTextInput('') as Blockly.Field, `PARAM_DESC_${j}`)
          }
          // Re-add return row
          if (this.hasReturn_) {
            this.appendDummyInput('RETURN_ROW')
              .appendField(Blockly.Msg['C_COMMENT_DOC_RETURN'] || '回傳')
              .appendField(new Blockly.FieldTextInput('') as Blockly.Field, 'RETURN')
          }
          // No tail — the block visually represents the doc comment without syntax noise
        },
        saveExtraState: function (this: any) {
          if (this.paramCount_ === 0 && !this.hasReturn_) return null
          return { paramCount: this.paramCount_, hasReturn: this.hasReturn_ }
        },
        loadExtraState: function (this: any, state: Record<string, unknown>) {
          this.paramCount_ = (state?.paramCount as number) ?? 0
          this.hasReturn_ = state?.hasReturn === true
          this.updateShape_()
        },
        decompose: function (this: any, workspace: Blockly.WorkspaceSvg) {
          const container = workspace.newBlock('c_doc_container')
          container.initSvg()
          let connection = container.getInput('STACK')!.connection!
          for (let i = 0; i < this.paramCount_; i++) {
            const paramBlock = workspace.newBlock('c_doc_param_input')
            paramBlock.initSvg()
            connection.connect(paramBlock.previousConnection!)
            connection = paramBlock.nextConnection!
          }
          if (this.hasReturn_) {
            const returnBlock = workspace.newBlock('c_doc_return_input')
            returnBlock.initSvg()
            connection.connect(returnBlock.previousConnection!)
          }
          return container
        },
        compose: function (this: any, containerBlock: Blockly.Block) {
          let paramCount = 0
          let hasReturn = false
          let clauseBlock = containerBlock.getInputTargetBlock('STACK')
          while (clauseBlock) {
            if (clauseBlock.type === 'c_doc_param_input') paramCount++
            else if (clauseBlock.type === 'c_doc_return_input') hasReturn = true
            clauseBlock = clauseBlock.getNextBlock()
          }
          this.paramCount_ = paramCount
          this.hasReturn_ = hasReturn
          this.updateShape_()
        },
      }
    }

    // ── Expression versions of statement-only blocks ──
    // These have output: "Expression" instead of previousStatement/nextStatement
    // Used in for-loop init/cond/update, while conditions, array indices, etc.

    // c_increment_expr — expression version of c_increment
    {
      Blockly.Blocks['c_increment_expr'] = {
        init: function (this: Blockly.Block) {
          this.appendDummyInput()
            .appendField(new Blockly.FieldDropdown(() => self.getWorkspaceVarOptions()) as Blockly.Field, 'NAME')
            .appendField(new Blockly.FieldDropdown([
              [Blockly.Msg['C_INCREMENT_OP_INCREMENT'] || '++', '++'],
              [Blockly.Msg['C_INCREMENT_OP_DECREMENT'] || '--', '--'],
            ]) as Blockly.Field, 'OP')
            .appendField(new Blockly.FieldDropdown([
              [Blockly.Msg['C_INCREMENT_POS_POSTFIX'] || '後置', 'postfix'],
              [Blockly.Msg['C_INCREMENT_POS_PREFIX'] || '前置', 'prefix'],
            ]) as Blockly.Field, 'POSITION')
          this.setOutput(true, 'Expression')
          this.setColour(CATEGORY_COLORS.operators)
          this.setTooltip(Blockly.Msg['C_INCREMENT_TOOLTIP'] || '遞增/遞減（運算式）')
        },
      }
    }

    // c_compound_assign_expr — expression version of c_compound_assign
    {
      Blockly.Blocks['c_compound_assign_expr'] = {
        init: function (this: Blockly.Block) {
          this.appendValueInput('VALUE')
            .setCheck('Expression')
            .appendField(new Blockly.FieldDropdown(() => self.getWorkspaceVarOptions()) as Blockly.Field, 'NAME')
            .appendField(new Blockly.FieldDropdown([
              ['+=', '+='],
              ['-=', '-='],
              ['*=', '*='],
              ['/=', '/='],
              ['%=', '%='],
            ]) as Blockly.Field, 'OP')
          this.setInputsInline(true)
          this.setOutput(true, 'Expression')
          this.setColour(CATEGORY_COLORS.operators)
          this.setTooltip(Blockly.Msg['C_COMPOUND_ASSIGN_TOOLTIP'] || '複合賦值（運算式）')
        },
      }
    }

    // u_input_expr — expression version of u_input (for use in if/while conditions, e.g. if(cin >> a))
    {
      Blockly.Blocks['u_input_expr'] = {
        argCount_: 1,
        argSlots_: [{ mode: 'select' }] as ArgSlotState[],
        init: function (this: any) {
          this.argCount_ = 1
          this.argSlots_ = [{ mode: 'select', selectedVar: 'x' }]
          buildArgSlot(this, 0, 'select', {
            getVarOptions: () => self.getWorkspaceVarOptions(),
            inputPrefix: Blockly.Msg['U_INPUT_LABEL'] || '讀取輸入 →',
            defaultVar: 'x',
          })
          try { this.setFieldValue('x', 'SEL_0') } catch (_e) { /* ignore */ }
          this.appendDummyInput('TAIL')
            .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plus_()))
            .appendField(new Blockly.FieldImage(MINUS_DISABLED_IMG, 20, 20, '-', () => this.minus_()), 'MINUS_BTN')
          this.setInputsInline(true)
          this.setOutput(true, 'Expression')
          this.setColour(CATEGORY_COLORS.io)
          this.setTooltip(Blockly.Msg['U_INPUT_EXPR_TOOLTIP'] || '讀取輸入（運算式，可作為條件）')
        },
        plus_: function (this: any) {
          const idx = this.argCount_
          this.argSlots_[idx] = { mode: 'select', selectedVar: 'v' + idx }
          buildArgSlot(this, idx, 'select', {
            getVarOptions: () => self.getWorkspaceVarOptions(),
            defaultVar: 'v' + idx,
          })
          this.moveInputBefore(`ARG_${idx}`, 'TAIL')
          try { this.setFieldValue('v' + idx, `SEL_${idx}`) } catch (_e) { /* ignore */ }
          this.argCount_++
          setMinusState(this, false)
        },
        minus_: function (this: any) {
          if (this.argCount_ <= 1) return
          this.argCount_--
          const idx = this.argCount_
          this.argSlots_.splice(idx, 1)
          this.removeInput(`ARG_${idx}`)
          setMinusState(this, this.argCount_ <= 1)
        },
        saveExtraState: function (this: any) {
          return { args: this.argSlots_.map((s: ArgSlotState) => ({ ...s })) }
        },
        loadExtraState: function (this: any, state: { args?: ArgSlotState[] }) {
          const args = state.args ?? [{ mode: 'select' }]
          this.argSlots_ = args.map(s => ({ ...s }))
          this.argCount_ = args.length
          // Remove existing ARG inputs and TAIL
          let i = 0
          while (this.getInput(`ARG_${i}`)) { this.removeInput(`ARG_${i}`); i++ }
          if (this.getInput('TAIL')) this.removeInput('TAIL')
          // Rebuild
          for (let j = 0; j < this.argCount_; j++) {
            const slot = this.argSlots_[j]
            buildArgSlot(this, j, slot.mode, {
              getVarOptions: () => self.getWorkspaceVarOptions(),
              inputPrefix: j === 0 ? (Blockly.Msg['U_INPUT_LABEL'] || '讀取輸入 →') : undefined,
              defaultVar: slot.text ?? slot.selectedVar ?? ('v' + j),
            })
            if (slot.mode === 'select' && (slot.text || slot.selectedVar)) {
              try { this.setFieldValue(slot.text ?? slot.selectedVar, `SEL_${j}`) } catch (_e) { /* ignore */ }
            }
          }
          this.appendDummyInput('TAIL')
            .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plus_()))
            .appendField(new Blockly.FieldImage(
              this.argCount_ <= 1 ? MINUS_DISABLED_IMG : MINUS_IMG,
              20, 20, '-', () => this.minus_()), 'MINUS_BTN')
        },
      }
    }

    // c_scanf_expr — expression version of c_scanf (for use in while conditions, etc.)
    {
      Blockly.Blocks['c_scanf_expr'] = {
        argCount_: 1,
        argSlots_: [{ mode: 'select' }] as ArgSlotState[],
        init: function (this: any) {
          this.argCount_ = 1
          this.argSlots_ = [{ mode: 'select', selectedVar: 'x' }]
          this.appendDummyInput('FORMAT_ROW')
            .appendField('scanf')
            .appendField(new Blockly.FieldTextInput('%d') as Blockly.Field, 'FORMAT')
          buildArgSlot(this, 0, 'select', {
            getVarOptions: () => self.getScanfVarOptions(),
            inputPrefix: ',',
            separator: ',',
            defaultVar: 'x',
          })
          try { this.setFieldValue('x', 'SEL_0') } catch (_e) { /* ignore */ }
          this.appendDummyInput('TAIL')
            .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plus_()))
            .appendField(new Blockly.FieldImage(MINUS_DISABLED_IMG, 20, 20, '-', () => this.minus_()), 'MINUS_BTN')
          this.setInputsInline(true)
          this.setOutput(true, 'Expression')
          this.setColour(CATEGORY_COLORS.io)
          this.setTooltip('scanf（運算式）')
          this.isArrayVar_ = isArrayVar
        },
        plus_: function (this: any) {
          const idx = this.argCount_
          this.argSlots_[idx] = { mode: 'select', selectedVar: 'x' }
          buildArgSlot(this, idx, 'select', {
            getVarOptions: () => self.getScanfVarOptions(),
            inputPrefix: ',',
            separator: ',',
            defaultVar: 'x',
          })
          this.moveInputBefore(`ARG_${idx}`, 'TAIL')
          try { this.setFieldValue('x', `SEL_${idx}`) } catch (_e) { /* ignore */ }
          this.argCount_++
          setMinusState(this, false)
        },
        minus_: function (this: any) {
          if (this.argCount_ <= 0) return
          this.argCount_--
          if (this.getInput(`ARG_${this.argCount_}`)) this.removeInput(`ARG_${this.argCount_}`)
          this.argSlots_.length = this.argCount_
          setMinusState(this, this.argCount_ <= 0)
        },
        saveExtraState: function (this: any) {
          const args: ArgSlotState[] = []
          for (let i = 0; i < this.argCount_; i++) {
            const slot = this.argSlots_[i]
            if (slot.mode === 'select') {
              args.push({ mode: 'select', text: this.getFieldValue(`SEL_${i}`) })
            } else if (slot.mode === 'custom') {
              args.push({ mode: 'custom', text: this.getFieldValue(`TEXT_${i}`) ?? '' })
            } else {
              args.push({ mode: 'compose' })
            }
          }
          return { args }
        },
        loadExtraState: function (this: any, state: { args?: ArgSlotState[] }) {
          const args = state?.args ?? []
          for (let i = this.argCount_ - 1; i >= 0; i--) {
            if (this.getInput(`ARG_${i}`)) this.removeInput(`ARG_${i}`)
          }
          this.argCount_ = args.length
          this.argSlots_ = [...args]
          for (let i = 0; i < args.length; i++) {
            const a = args[i]
            buildArgSlot(this, i, a.mode, {
              getVarOptions: () => self.getScanfVarOptions(),
              inputPrefix: ',',
              separator: ',',
              defaultVar: a.text ?? 'x',
              customDefault: a.text ?? '',
            })
            this.moveInputBefore(`ARG_${i}`, 'TAIL')
            if (a.mode === 'select' && a.text) {
              try { this.setFieldValue(a.text, `SEL_${i}`) } catch (_e) { /* ignore */ }
            }
          }
          setMinusState(this, this.argCount_ <= 0)
        },
      }
    }

    // c_var_declare_expr — expression version for for-loop init (int i = 2)
    {
      Blockly.Blocks['c_var_declare_expr'] = {
        init: function (this: Blockly.Block) {
          this.appendValueInput('INIT_0')
            .setCheck('Expression')
            .appendField(self.createOpenDropdown(() => getTypeOptions()) as Blockly.Field, 'TYPE')
            .appendField(new Blockly.FieldTextInput('i') as Blockly.Field, 'NAME_0')
            .appendField('=')
          this.setInputsInline(true)
          this.setOutput(true, 'Expression')
          this.setColour(CATEGORY_COLORS.data)
          this.setTooltip('變數宣告（運算式）')
        },
      }
    }
  }

  private buildToolbox(level?: CognitiveLevel, ioPreference?: 'iostream' | 'cstdio'): object {
    const lv = level ?? this.currentLevel
    const ioPref = ioPreference ?? 'iostream'

    // Registry-driven: get blocks by category and level from BlockSpec
    const registryBlocks = (category: string): { kind: string; type: string }[] => {
      const specs = this.blockSpecRegistry.listByCategory(category, lv)
      return specs
        .filter(s => {
          const blockType = (s.blockDef as Record<string, unknown>)?.type as string | undefined
          return blockType && isBlockAvailable(blockType, lv)
        })
        .map(s => ({ kind: 'block', type: (s.blockDef as Record<string, unknown>).type as string }))
    }

    // I/O 類別需要合併 universal io + cpp io，並依 style 排序
    const buildIoCategory = () => {
      const ioSpecs = [
        ...this.blockSpecRegistry.listByCategory('io', lv),
        ...this.blockSpecRegistry.listByCategory('cpp_io', lv),
      ]
      const ioTypes = ioSpecs
        .map(s => (s.blockDef as Record<string, unknown>)?.type as string)
        .filter(t => t && isBlockAvailable(t, lv))

      // 確保核心 I/O 積木在列表中（動態積木可能不在 registry 中）
      const ensureTypes = ['u_print', 'u_input', 'u_endl', 'c_printf', 'c_scanf']
      for (const t of ensureTypes) {
        if (!ioTypes.includes(t) && isBlockAvailable(t, lv)) {
          ioTypes.push(t)
        }
      }

      // 依 ioPreference 排序
      const universalIo = ioTypes.filter(t => t.startsWith('u_'))
      const cppIo = ioTypes.filter(t => t.startsWith('c_'))
      const sorted = ioPref === 'iostream'
        ? [...universalIo, ...cppIo]
        : [...cppIo, ...universalIo]
      return sorted.map(t => ({ kind: 'block', type: t }))
    }

    // 類別定義（順序固定，內容由 registry 動態生成）
    type ExtraBlockDef = string | { type: string; extraState?: Record<string, unknown>; level?: CognitiveLevel }
    const CATEGORY_DEFS: Array<{ key: string; nameKey: string; fallback: string; colorKey: string; registryCategories: string[]; extraTypes?: ExtraBlockDef[]; excludeTypes?: string[] }> = [
      { key: 'data', nameKey: 'CATEGORY_DATA', fallback: '資料', colorKey: 'data', registryCategories: ['data'], extraTypes: ['u_var_declare', 'u_var_assign', 'u_var_ref', 'u_number', 'u_string'] },
      { key: 'operators', nameKey: 'CATEGORY_OPERATORS', fallback: '運算', colorKey: 'operators', registryCategories: ['operators'], extraTypes: ['u_arithmetic', 'u_compare', 'u_logic', 'u_logic_not', 'u_negate'] },
      { key: 'control', nameKey: 'CATEGORY_CONTROL', fallback: '控制', colorKey: 'control', registryCategories: ['control', 'loops'], excludeTypes: ['u_if_else'], extraTypes: [
        { type: 'u_if' },
        { type: 'u_if', extraState: { hasElse: true } },
        { type: 'u_if', extraState: { elseifCount: 1, hasElse: true }, level: 1 },
        'u_while_loop', 'u_count_loop', 'u_break', 'u_continue',
      ] },
      { key: 'functions', nameKey: 'CATEGORY_FUNCTIONS', fallback: '函式', colorKey: 'functions', registryCategories: ['functions'], extraTypes: ['u_func_def', 'u_func_call', 'u_func_call_expr', 'u_return'] },
      { key: 'arrays', nameKey: 'CATEGORY_ARRAYS', fallback: '陣列', colorKey: 'arrays', registryCategories: ['arrays'], extraTypes: ['u_array_declare', 'u_array_access', 'u_array_assign'] },
      { key: 'cpp_basic', nameKey: 'CATEGORY_CPP_BASIC', fallback: 'C++ 基礎', colorKey: 'cpp_basic', registryCategories: ['cpp_basic', 'conditions', 'preprocessor'] },
      { key: 'cpp_pointers', nameKey: 'CATEGORY_CPP_POINTERS', fallback: 'C++ 指標', colorKey: 'cpp_pointers', registryCategories: ['pointers'] },
      { key: 'cpp_structs', nameKey: 'CATEGORY_CPP_STRUCTS', fallback: 'C++ 結構/類別', colorKey: 'cpp_structs', registryCategories: ['structures', 'oop'] },
      { key: 'cpp_strings', nameKey: 'CATEGORY_CPP_STRINGS', fallback: 'C++ 字串', colorKey: 'cpp_strings', registryCategories: ['strings'] },
      { key: 'cpp_containers', nameKey: 'CATEGORY_CPP_CONTAINERS', fallback: 'C++ 容器', colorKey: 'cpp_containers', registryCategories: ['containers'] },
      { key: 'cpp_algorithms', nameKey: 'CATEGORY_CPP_ALGORITHMS', fallback: 'C++ 演算法', colorKey: 'cpp_algorithms', registryCategories: ['algorithms'] },
      { key: 'cpp_special', nameKey: 'CATEGORY_CPP_SPECIAL', fallback: 'C++ 特殊', colorKey: 'cpp_special', registryCategories: ['special', 'preprocessor'] },
    ]

    const categories = CATEGORY_DEFS.map(def => {
      // Merge blocks from all registry categories
      const excludeSet = new Set(def.excludeTypes ?? [])
      const blockSet = new Set<string>()
      for (const cat of def.registryCategories) {
        for (const b of registryBlocks(cat)) {
          if (!excludeSet.has(b.type)) blockSet.add(b.type)
        }
      }
      // Ensure dynamic blocks (registered in code, not in JSON) are included
      // extraTypes can be strings or objects with extraState for preconfigured variants
      // Object-form entries replace their type in-place; string entries append if missing
      type ToolboxEntry = { kind: string; type: string; extraState?: Record<string, unknown> }
      const extraReplacements = new Map<string, ToolboxEntry[]>() // type → replacement entries
      const extraAppend: ToolboxEntry[] = []
      if (def.extraTypes) {
        for (const t of def.extraTypes) {
          if (typeof t === 'string') {
            if (!isBlockAvailable(t, lv)) continue
            if (!blockSet.has(t)) extraAppend.push({ kind: 'block', type: t })
            blockSet.add(t)
          } else {
            const effectiveLevel = t.level ?? getBlockLevel(t.type)
            if (effectiveLevel > lv) continue
            if (!extraReplacements.has(t.type)) extraReplacements.set(t.type, [])
            extraReplacements.get(t.type)!.push({ kind: 'block', type: t.type, ...(t.extraState ? { extraState: t.extraState } : {}) })
          }
        }
      }
      // Build contents: replace registry blocks with their variants in-place
      const contents: ToolboxEntry[] = []
      for (const t of blockSet) {
        if (extraReplacements.has(t)) {
          contents.push(...extraReplacements.get(t)!)
        } else {
          contents.push({ kind: 'block', type: t })
        }
      }
      contents.push(...extraAppend)
      return {
        kind: 'category',
        name: (Blockly.Msg as Record<string, string>)[def.nameKey] || def.fallback,
        colour: CATEGORY_COLORS[def.colorKey] || CATEGORY_COLORS.data,
        contents,
      }
    })

    // Insert I/O category after functions
    const funcIdx = categories.findIndex(c => c.name === ((Blockly.Msg as Record<string, string>)['CATEGORY_FUNCTIONS'] || '函式'))
    const ioCategory = {
      kind: 'category',
      name: (Blockly.Msg as Record<string, string>)['CATEGORY_IO'] || '輸入/輸出',
      colour: CATEGORY_COLORS.io,
      contents: buildIoCategory(),
    }
    categories.splice(funcIdx + 1, 0, ioCategory)

    // Only include categories with at least one block
    return {
      kind: 'categoryToolbox',
      contents: categories.filter(c => c.contents.length > 0),
    }
  }

  private async setupCodeToBlocksPipeline(): Promise<void> {
    const lifter = new Lifter()

    // Initialize registries (three-layer architecture)
    const transformRegistry = new TransformRegistry()
    registerCoreTransforms(transformRegistry)
    const liftStrategyRegistry = new LiftStrategyRegistry()
    const renderStrategyRegistry = new RenderStrategyRegistry()

    // Wire up JSON-driven PatternLifter
    const allSpecs = this.blockSpecRegistry.getAll()
    const pl = new PatternLifter()
    pl.setTransformRegistry(transformRegistry)
    pl.setLiftStrategyRegistry(liftStrategyRegistry)
    const liftSkipNodeTypes = new Set(['call_expression', 'using_declaration', 'for_statement', 'assignment_expression', 'update_expression', 'switch_statement', 'case_statement', 'do_statement', 'conditional_expression', 'cast_expression'])
    pl.loadBlockSpecs(allSpecs, liftSkipNodeTypes)
    pl.loadLiftPatterns(liftPatternsJson as unknown as LiftPattern[])
    lifter.setPatternLifter(pl)

    // Wire up JSON-driven PatternRenderer
    const pr = new PatternRenderer()
    pr.setRenderStrategyRegistry(renderStrategyRegistry)
    pr.loadBlockSpecs(allSpecs)
    setPatternRenderer(pr)

    // Register hand-written lifters as fallback
    registerCppLifters(lifter, { transformRegistry, liftStrategyRegistry, renderStrategyRegistry })

    const parser = new CppParser()
    await parser.init()

    // Adapt CppParser (async) to CodeParser interface (sync-like)
    // We store the last parse result and use it synchronously
    const codeParser = {
      _lastTree: null as unknown,
      parse(_code: string) {
        // CppParser.parse is async, but we pre-parse before sync
        return { rootNode: this._lastTree }
      },
    }

    this.syncController!.setCodeToBlocksPipeline(lifter, codeParser)

    // Override syncCodeToBlocks to handle async parsing
    const originalSync = this.syncController!.syncCodeToBlocks.bind(this.syncController!)
    const monacoPanel = this.monacoPanel!

    this.syncController!.syncCodeToBlocks = () => {
      const code = monacoPanel.getCode()
      this._codeToBlocksInProgress = true
      parser.parse(code).then(tree => {
        codeParser._lastTree = tree.rootNode
        originalSync()
        this.codeDirty = false
        this.blocksDirty = false
        this.updateSyncHints()
        // Clear flag after Blockly deferred events settle (multiple frames)
        setTimeout(() => { this._codeToBlocksInProgress = false }, 300)
      }).catch(err => {
        console.error('Parse error:', err)
        this._codeToBlocksInProgress = false
      })
      return false
    }

    this.syncController!.onError((errors: SyncError[]) => {
      const messages = errors.map(e => e.message).join('\n')
      console.warn('Sync errors:', messages)
      showToast(Blockly.Msg['TOAST_ERROR'] || `⚠ ${errors.length} 個語法錯誤`, 'error')
    })

    // Style conformance — 借音 (minor exception) vs 轉調 (bulk deviation)
    this.syncController!.setCodingStyle(this.currentStylePreset)

    // Code-level I/O conformance (before lift)
    this.syncController!.onIoConformance((result) => {
      const currentIo = this.currentStylePreset.io_style === 'printf' ? 'printf/scanf' : 'cout/cin'
      const otherIo = this.currentStylePreset.io_style === 'printf' ? 'cout/cin' : 'printf/scanf'

      if (result.verdict === 'bulk_deviation') {
        // 轉調 — majority doesn't match preset → suggest switching preset
        const otherPreset = STYLE_PRESETS.find(p =>
          p.io_style !== this.currentStylePreset.io_style,
        )
        if (!otherPreset) return
        const otherName = otherPreset.name['zh-TW'] || otherPreset.id
        showStyleActionBar(
          `程式碼大量使用 ${otherIo}，但目前風格為 ${currentIo}`,
          [
            { label: `切換到「${otherName}」`, primary: true, action: () => {
              this.currentStylePreset = otherPreset
              this.syncController?.setStyle(otherPreset)
              this.syncController?.setCodingStyle(otherPreset)
              this.styleSelector?.setValue(otherPreset.id)
              this.updateStatusBar()
              const ioPref = otherPreset.io_style === 'printf' ? 'cstdio' : 'iostream'
              if (ioPref !== this.currentIoPreference) {
                this.currentIoPreference = ioPref
                this.updateToolboxForLevel(this.currentLevel)
              }
              this.syncController?.syncBlocksToCode()
            }},
            { label: '保持目前風格', action: () => { /* no-op */ } },
          ],
        )
      } else if (result.verdict === 'minor_exception') {
        // 借音 — a few off-key notes → ask if intentional
        showStyleActionBar(
          `偵測到少數 ${otherIo} 用法（目前風格為 ${currentIo}）`,
          [
            { label: '保留（刻意使用）', action: () => { /* intentional — keep */ } },
            { label: `統一為 ${currentIo}`, primary: true, action: () => {
              this.syncController?.syncBlocksToCode()
            }},
          ],
        )
      }
    })

    // Semantic-level style exceptions (after lift — toolbox block mismatches)
    this.syncController!.onStyleExceptions((exceptions, apply) => {
      const items = exceptions.map(e => `${e.label} → ${e.suggestion}`).join('、')
      showStyleActionBar(
        `積木風格不符：${items}`,
        [
          { label: '自動轉換', primary: true, action: () => {
            apply()
            this.syncController?.syncBlocksToCode()
          }},
          { label: '保留', action: () => { /* no-op */ } },
        ],
      )
    })
  }

  private setupLevelSelector(): void {
    const mount = document.getElementById('level-selector-mount')
    if (!mount) return
    this.levelSelector = new LevelSelector(mount)
    this.levelSelector.setLevel(this.currentLevel)
    this.levelSelector.onChange((level) => {
      this.currentLevel = level
      this.updateToolboxForLevel(level)
      this.quickAccessBar?.setLevel(level)
      this.updateStatusBar()
    })
  }

  private setupStyleSelector(): void {
    const mount = document.getElementById('style-selector-mount')
    if (!mount) return
    this.styleSelector = new StyleSelector(mount, STYLE_PRESETS)
    this.styleSelector.onChange((style) => {
      this.syncController?.setStyle(style)
      this.syncController?.setCodingStyle(style)
      this.syncController?.syncBlocksToCode()
      this.currentStylePreset = style
      this.updateStatusBar()
      // 更新 toolbox I/O 排序
      const ioPref = style.io_style === 'printf' ? 'cstdio' : 'iostream'
      if (ioPref !== this.currentIoPreference) {
        this.currentIoPreference = ioPref
        this.updateToolboxForLevel(this.currentLevel)
      }
    })
  }

  private setupBlockStyleSelector(): void {
    const mount = document.getElementById('block-style-selector-mount')
    if (!mount) return
    const selector = new BlockStyleSelector(mount)
    selector.onChange((preset: BlockStylePreset) => {
      if (!this.blocklyPanel) return
      const currentRenderer = this.blocklyPanel.getRenderer()
      if (preset.renderer !== currentRenderer) {
        // Renderer 不同：需重建 workspace
        const toolbox = this.buildToolbox(this.currentLevel, this.currentIoPreference)
        this.blocklyPanel.reinitWithPreset(toolbox, preset)
        // 重新連接 change listener
        this.blocklyPanel.onChange(() => {
          if (this._codeToBlocksInProgress) return
          this.blocksDirty = true
          this.updateSyncHints()
          if (this.autoSync) {
            this.syncController!.syncBlocksToCode()
            this.blocksDirty = false
            this.updateSyncHints()
          }
          this.runBlockDiagnostics()
          this.autoSave()
        })
      }
      this.currentBlockStyleId = preset.id
      this.updateStatusBar()
    })
  }

  private setupLocaleSelector(): void {
    const mount = document.getElementById('locale-selector-mount')
    if (!mount) return
    const selector = new LocaleSelector(mount)
    selector.onChange(async (locale) => {
      await this.localeLoader.load(locale)
      this.currentLocale = locale
      // Rebuild toolbox to update category names
      this.updateToolboxForLevel(this.currentLevel)
      // Re-render blocks to update messages
      this.syncController?.syncBlocksToCode()
      this.updateStatusBar()
    })
  }

  private currentStylePreset: StylePreset = DEFAULT_STYLE
  private styleSelector: StyleSelector | null = null
  private currentBlockStyleId: string = 'scratch'
  private currentLocale: string = 'zh-TW'

  private updateStatusBar(style?: StylePreset): void {
    const statusBar = document.getElementById('status-bar')
    if (!statusBar) return
    if (style) this.currentStylePreset = style
    const s = this.currentStylePreset
    const styleName = s.name[this.currentLocale] || s.name['zh-TW'] || s.id
    const blockStyleLabel = (Blockly.Msg as Record<string, string>)[`BLOCK_STYLE_${this.currentBlockStyleId.toUpperCase()}`] || this.currentBlockStyleId
    const levelLabel = `L${this.currentLevel}`
    statusBar.innerHTML = `<span>C++ | ${styleName} | ${blockStyleLabel} | ${levelLabel} | ${this.currentLocale}</span>`
  }

  private updateToolboxForLevel(level: CognitiveLevel): void {
    if (!this.blocklyPanel) return
    const workspace = this.blocklyPanel.getWorkspace()
    if (!workspace) return
    const toolbox = this.buildToolbox(level, this.currentIoPreference)
    workspace.updateToolbox(toolbox as Blockly.utils.toolbox.ToolboxDefinition)
  }

  private setupToolbar(): void {
    // Replace elements to remove old event listeners (prevent HMR duplication)
    const replaceBtn = (id: string) => {
      const el = document.getElementById(id)
      if (el) {
        const clone = el.cloneNode(true) as HTMLElement
        el.parentNode?.replaceChild(clone, el)
        return clone
      }
      return null
    }

    replaceBtn('auto-sync-btn')?.addEventListener('click', () => {
      this.toggleAutoSync()
    })
    replaceBtn('sync-blocks-btn')?.addEventListener('click', () => {
      this.syncController?.syncBlocksToCode()
      this.blocksDirty = false
      this.updateSyncHints()
    })
    replaceBtn('sync-code-btn')?.addEventListener('click', () => {
      this.syncController?.syncCodeToBlocks()
    })
    replaceBtn('undo-btn')?.addEventListener('click', () => {
      this.blocklyPanel?.undo()
    })
    replaceBtn('redo-btn')?.addEventListener('click', () => {
      this.blocklyPanel?.redo()
    })
    replaceBtn('clear-btn')?.addEventListener('click', () => {
      this.blocklyPanel?.clear()
    })
    replaceBtn('export-btn')?.addEventListener('click', () => {
      this.exportWorkspace()
    })
    replaceBtn('import-btn')?.addEventListener('click', () => {
      this.importWorkspace()
    })
    replaceBtn('upload-blocks-btn')?.addEventListener('click', () => {
      this.uploadCustomBlocks()
    })
  }

  private exportWorkspace(): void {
    const state: SavedState = {
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
    const blob = this.storageService.exportToBlob(state)
    this.storageService.downloadBlob(blob, `code-blockly-${Date.now()}.json`)
    showToast(Blockly.Msg['TOAST_EXPORT_SUCCESS'] || '已匯出', 'success')
  }

  private importWorkspace(): void {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        const state = this.storageService.importFromJSON(reader.result as string)
        if (!state) {
          showToast(Blockly.Msg['TOAST_IMPORT_ERROR'] || '匯入失敗：無效的 JSON', 'error')
          return
        }
        if (state.blocklyState && Object.keys(state.blocklyState).length > 0) {
          this.blocklyPanel?.setState(state.blocklyState)
        }
        if (state.code) {
          this.monacoPanel?.setCode(state.code)
        }
        showToast(Blockly.Msg['TOAST_IMPORT_SUCCESS'] || '已匯入', 'success')
      }
      reader.readAsText(file)
    })
    input.click()
  }

  private uploadCustomBlocks(): void {
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
            if (!Blockly.Blocks[blockDef.type]) {
              Blockly.common.defineBlocksWithJsonArray([blockDef])
            }
          }
          // Refresh toolbox to include new blocks
          this.updateToolboxForLevel(this.currentLevel)
          showToast(Blockly.Msg['TOAST_UPLOAD_SUCCESS'] || `Uploaded ${blocks.length} custom blocks`, 'success')
        } catch {
          showToast(Blockly.Msg['TOAST_UPLOAD_ERROR'] || 'Failed to parse JSON file', 'error')
        }
      }
      reader.readAsText(file)
    })
    input.click()
  }

  private autoSave(): void {
    this.storageService.save({
      blocklyState: this.blocklyPanel?.getState() ?? {},
      code: this.monacoPanel?.getCode() ?? '',
      tree: this.syncController?.getCurrentTree() ?? null,
      level: this.currentLevel,
    })
  }

  private restoreState(): void {
    const state = this.storageService.load()
    if (!state) return
    try {
      if (state.blocklyState && Object.keys(state.blocklyState).length > 0) {
        this.blocklyPanel?.setState(state.blocklyState)
      }
      if (state.code) {
        this.monacoPanel?.setCode(state.code)
      }
    } catch (err) {
      console.warn('Failed to restore saved state, clearing:', err)
      this.storageService.clear()
    }
  }

  private setupExecution(): void {
    const replaceBtn = (id: string) => {
      const el = document.getElementById(id)
      if (el) {
        const clone = el.cloneNode(true) as HTMLElement
        el.parentNode?.replaceChild(clone, el)
        return clone
      }
      return null
    }

    // Main run button — executes using current runMode
    replaceBtn('run-btn')?.addEventListener('click', () => this.executeWithCurrentMode())

    // Dropdown arrow — toggle menu
    const modeBtn = replaceBtn('run-mode-btn')
    const modeMenu = document.getElementById('run-mode-menu')
    modeBtn?.addEventListener('click', (e) => {
      e.stopPropagation()
      if (modeMenu) {
        const visible = modeMenu.style.display !== 'none'
        modeMenu.style.display = visible ? 'none' : ''
        if (!visible) this.updateRunModeMenu()
      }
    })

    // Menu option click
    modeMenu?.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('.run-mode-option') as HTMLElement | null
      if (!target) return
      const mode = target.dataset.mode as typeof this.runMode
      if (mode) {
        this.runMode = mode
        this.updateRunButtonLabel()
        modeMenu.style.display = 'none'
        // Execute immediately after selecting mode
        this.executeWithCurrentMode()
      }
    })

    // Close menu on outside click
    document.addEventListener('click', () => {
      if (modeMenu) modeMenu.style.display = 'none'
    })

    // Console Ctrl signals
    this.consolePanel?.onSignal((signal) => {
      if (signal === 'SIGINT') {
        // Abort interpreter — handleRun's catch/finally will clean up UI
        this.interpreter?.abort()
        // If in stepping mode, also stop the step controller
        if (this.stepController?.getStatus() === 'stepping' || this.stepController?.getStatus() === 'paused') {
          this.handleStop()
        }
      }
    })

    // Floating debug toolbar (VSCode-style)
    this.debugToolbar = new DebugToolbar()
    this.debugToolbar.onAction((action) => {
      switch (action) {
        case 'continue':
          if (this.animatePaused && this.animateResolve) {
            // Resume real-time animation
            this.animatePaused = false
            this.debugToolbar?.setMode('running')
            this.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_RUNNING'] || 'Running', 'running')
            this.animateResolve()
          } else {
            this.stepController?.resume()
            this.debugToolbar?.setMode('running')
            this.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_RUNNING'] || 'Running', 'running')
          }
          break
        case 'pause':
          if (this.animateResolve === null && this.interpreter) {
            // Real-time animation running — set flag, will pause at next step
            this.animatePaused = true
          } else {
            this.handlePause()
          }
          this.debugToolbar?.setMode('paused')
          break
        case 'step':
          if (this.animatePaused && this.animateResolve) {
            // Single step in animation: resume then immediately pause again
            this.animatePaused = true
            this.animateResolve()
          } else {
            this.handleStep()
          }
          break
        case 'step-out':
          this.handleStepOut()
          break
        case 'accelerate':
          this.handleAccelerate()
          break
        case 'stop':
          // If animation is paused, unblock the promise first
          if (this.animateResolve) {
            const resolve = this.animateResolve
            this.animateResolve = null
            resolve()
          }
          this.interpreter?.abort()
          this.handleStop()
          break
      }
    })
  }

  private async handleRun(): Promise<void> {
    // Check unsync
    if (this.blocksDirty) {
      const sync = confirm(Blockly.Msg['EXEC_UNSYNC_PROMPT'] || 'Blocks have changed. Sync before running?')
      if (sync) {
        this.syncController?.syncBlocksToCode()
      }
    }

    const tree = this.blocklyPanel?.extractSemanticTree()
    if (!tree) return

    this.resetExecution()
    this.interpreter = new SemanticInterpreter({ maxSteps: 10_000_000 })
    this.interpreter.setInputProvider(() => this.consolePanel!.promptInput())
    // Real-time output: stream to console as interpreter writes
    this.interpreter.setOutputCallback((text: string) => {
      this.consolePanel?.write(text)
    })
    // Highlight block/line when waiting for input
    this.interpreter.setWaitingCallback((blockId) => {
      this.blocklyPanel?.clearHighlight()
      if (blockId && this.blocklyPanel?.getWorkspace()) {
        this.blocklyPanel.highlightBlock(blockId, 'execution')
        // Always scroll to input block so user knows where to type
        this.blocklyPanel.getWorkspace()!.centerOnBlock(blockId)
        const mapping = this.syncController?.getMappingForBlock(blockId)
        if (mapping && this.monacoPanel) {
          this.highlightMonacoLines(mapping.startLine + 1, mapping.endLine + 1)
          this.monacoPanel.revealLine(mapping.startLine + 1)
        }
      }
    })

    this.showExecButtons(true)
    this.consolePanel?.clear()
    this.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_RUNNING'] || 'Running', 'running')
    this.bottomPanel?.showTab('console')

    try {
      await this.interpreter.execute(tree as unknown as InterpreterNode)
      this.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_COMPLETED'] || 'Completed', 'completed')
      showToast(Blockly.Msg['TOAST_EXEC_COMPLETE'] || 'Program completed', 'success')
    } catch (e) {
      if (e instanceof RuntimeError) {
        if (e.i18nKey === 'RUNTIME_ERR_ABORTED') {
          // User-initiated abort (Ctrl+C) — not an error
          this.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_ABORTED'] || 'Interrupted', '')
        } else {
          this.consolePanel?.error(e.message)
          this.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_ERROR'] || 'Error', 'error')
          showToast(Blockly.Msg['TOAST_EXEC_ERROR'] || 'Execution error', 'error')
        }
      } else {
        this.consolePanel?.error(String(e))
        this.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_ERROR'] || 'Error', 'error')
      }
    } finally {
      this.showExecButtons(false)
    }
  }

  private async handleStep(): Promise<void> {
    if (this.stepController?.getStatus() === 'stepping' || this.stepController?.getStatus() === 'paused') {
      // Continue stepping
      this.stepController.step()
      return
    }

    // Start new step session
    if (this.blocksDirty) {
      const sync = confirm(Blockly.Msg['EXEC_UNSYNC_PROMPT'] || 'Blocks have changed. Sync before running?')
      if (sync) {
        this.syncController?.syncBlocksToCode()
      }
    }

    const tree = this.blocklyPanel?.extractSemanticTree()
    if (!tree) return

    this.resetExecution()
    this.interpreter = new SemanticInterpreter({ maxSteps: 10_000_000 })
    this.interpreter.setInputProvider(() => this.consolePanel!.promptInput())
    this.interpreter.setOutputCallback((text: string) => {
      this.consolePanel?.write(text)
    })
    this.interpreter.setWaitingCallback((blockId) => {
      this.blocklyPanel?.clearHighlight()
      if (blockId && this.blocklyPanel?.getWorkspace()) {
        this.blocklyPanel.highlightBlock(blockId, 'execution')
        this.blocklyPanel.getWorkspace()!.centerOnBlock(blockId)
        const mapping = this.syncController?.getMappingForBlock(blockId)
        if (mapping && this.monacoPanel) {
          this.highlightMonacoLines(mapping.startLine + 1, mapping.endLine + 1)
          this.monacoPanel.revealLine(mapping.startLine + 1)
        }
      }
    })
    this.consolePanel?.clear()
    this.bottomPanel?.showTab('variables')
    this.showExecButtons(true, 'stepping')

    try {
      this.stepRecords = await this.interpreter.executeWithSteps(tree as unknown as InterpreterNode)
    } catch (e) {
      if (e instanceof RuntimeError) {
        this.consolePanel?.error(e.message)
        this.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_ERROR'] || 'Error', 'error')
        this.showExecButtons(false)
        return
      }
    }

    this.currentStepIndex = -1
    this.stepController = new StepController()

    const speedSelect = document.getElementById('speed-select') as HTMLSelectElement | null
    if (speedSelect) {
      this.stepController.setSpeed(speedSelect.value as ExecutionSpeed)
    }

    this.stepController.setStepFn(() => {
      this.currentStepIndex++
      return this.currentStepIndex < this.stepRecords.length - 1
    })

    this.stepController.onStep(() => {
      this.displayStep(this.currentStepIndex)

      // Check breakpoints
      const step = this.stepRecords[this.currentStepIndex]
      if (step?.blockId) {
        const mapping = this.syncController?.getMappingForBlock(step.blockId)
        if (mapping) {
          const breakpoints = this.monacoPanel?.getBreakpoints() ?? []
          // Monaco 1-based, mapping 0-based
          const hitBreakpoint = breakpoints.some(bp => bp >= mapping.startLine + 1 && bp <= mapping.endLine + 1)
          if (hitBreakpoint && this.stepController?.getStatus() === 'running') {
            this.stepController.pause()
            this.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_PAUSED'] || 'Paused (breakpoint)', 'running')
            this.debugToolbar?.setMode('paused')
          }
        }
      }
    })

    this.stepController.onStop(() => {
      this.clearHighlights()
      this.variablePanel?.clear()
      this.showExecButtons(false)
    })

    this.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_RUNNING'] || 'Running', 'running')

    // Execute first step
    this.stepController.step()
  }

  private handlePause(): void {
    if (this.stepController?.getStatus() === 'running') {
      this.stepController.pause()
      this.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_PAUSED'] || 'Paused', 'running')
      this.debugToolbar?.setMode('paused')
    }
  }

  private handleStepOut(): void {
    if (!this.stepController || !this.stepRecords.length) return
    const status = this.stepController.getStatus()
    if (status !== 'stepping' && status !== 'paused') return

    // Get current blockId, advance until it changes
    const currentBlockId = this.stepRecords[this.currentStepIndex]?.blockId
    if (!currentBlockId) {
      // No block context — just do a single step
      this.stepController.step()
      return
    }

    // Advance through steps with same blockId
    while (this.currentStepIndex < this.stepRecords.length - 1) {
      const nextStep = this.stepRecords[this.currentStepIndex + 1]
      if (nextStep?.blockId !== currentBlockId) break
      this.currentStepIndex++
    }

    // Do one more step to land on the next block
    this.stepController.step()
  }

  private handleAccelerate(): void {
    const currentBlockId = this.stepRecords[this.currentStepIndex]?.blockId
    if (!currentBlockId) return

    // Real-time animation mode: collect skipIds, interpreter will skip delay
    if (this.interpreter && !this.stepController) {
      const level = this.debugToolbar?.getAccelerateLevel() ?? 1
      const workspace = this.blocklyPanel?.getWorkspace()
      let targetBlock = workspace?.getBlockById(currentBlockId) ?? null

      if (level > 1 && targetBlock) {
        for (let i = 1; i < level && targetBlock; i++) {
          const parent = targetBlock.getSurroundParent()
          if (!parent) break
          targetBlock = parent
        }
      }

      // Collect all descendant blockIds of the target block
      const skipIds = new Set<string>()
      if (targetBlock) {
        const collectIds = (block: Blockly.Block) => {
          skipIds.add(block.id)
          for (const child of block.getChildren(false)) {
            collectIds(child)
          }
        }
        collectIds(targetBlock)
      } else {
        skipIds.add(currentBlockId)
      }
      this.animateAccelerateSkipIds = skipIds

      // If paused, resume to let it fast-forward
      if (this.animatePaused && this.animateResolve) {
        this.animatePaused = false
        this.debugToolbar?.setMode('running')
        this.animateResolve()
      }
      return
    }

    // Pre-recorded step mode (StepController)
    if (!this.stepController || !this.stepRecords.length) return
    const status = this.stepController.getStatus()
    if (status === 'completed' || status === 'idle') return

    const wasRunning = status === 'running'
    if (wasRunning) this.stepController.pause()

    const level = this.debugToolbar?.getAccelerateLevel() ?? 1
    const workspace = this.blocklyPanel?.getWorkspace()

    if (level <= 1) {
      while (this.currentStepIndex < this.stepRecords.length - 1) {
        const nextStep = this.stepRecords[this.currentStepIndex + 1]
        if (nextStep?.blockId !== currentBlockId) break
        this.currentStepIndex++
      }
    } else {
      let targetBlock = workspace?.getBlockById(currentBlockId) ?? null
      for (let i = 1; i < level && targetBlock; i++) {
        const parent = targetBlock.getSurroundParent()
        if (!parent) break
        targetBlock = parent
      }
      const skipIds = new Set<string>()
      const collectIds = (block: Blockly.Block) => {
        skipIds.add(block.id)
        for (const child of block.getChildren(false)) {
          collectIds(child)
        }
      }
      if (targetBlock) collectIds(targetBlock)
      while (this.currentStepIndex < this.stepRecords.length - 1) {
        const nextStep = this.stepRecords[this.currentStepIndex + 1]
        if (!nextStep?.blockId || !skipIds.has(nextStep.blockId)) break
        this.currentStepIndex++
      }
    }
    this.displayStep(this.currentStepIndex)
    if (wasRunning) {
      this.stepController.resume()
    } else {
      this.stepController.step()
    }
  }

  private handleStop(): void {
    this.stepController?.stop()
    this.clearHighlights()
    this.variablePanel?.clear()
    this.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_IDLE'] || 'Ready', '')
    this.showExecButtons(false)
  }

  private displayStep(index: number): void {
    if (index < 0 || index >= this.stepRecords.length) return
    const step = this.stepRecords[index]

    // Update variable panel
    this.variablePanel?.updateFromSnapshot(step.scopeSnapshot)
    this.bottomPanel?.showTab('variables')

    // Highlight block with execution color
    this.blocklyPanel?.clearHighlight()
    const autoScroll = this.debugToolbar?.isAutoScrollEnabled() ?? false
    if (step.blockId && this.blocklyPanel?.getWorkspace()) {
      this.blocklyPanel.highlightBlock(step.blockId, 'execution')
      if (autoScroll) {
        this.blocklyPanel.getWorkspace()!.centerOnBlock(step.blockId)
      }
    }

    // Highlight code line via source mapping
    if (step.blockId) {
      const mapping = this.syncController?.getMappingForBlock(step.blockId)
      if (mapping && this.monacoPanel) {
        this.highlightMonacoLines(mapping.startLine + 1, mapping.endLine + 1)
        if (autoScroll) {
          this.monacoPanel.revealLine(mapping.startLine + 1)
        }
      }
    }

    // Update console output up to this step
    // (show only output lines up to step.outputLength)

    if (this.stepController?.getStatus() === 'completed') {
      this.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_COMPLETED'] || 'Completed', 'completed')
      this.showExecButtons(false)
    }
  }

  private _highlightDirection: 'block-to-code' | 'code-to-block' | null = null

  private setupBidirectionalHighlight(): void {
    // Block → Code highlighting (yellow on both block and code)
    this.blocklyPanel?.onBlockSelect((blockId) => {
      if (!blockId) {
        // Deselection: only clear if we were in block-to-code mode
        if (this._highlightDirection === 'block-to-code') {
          this.monacoPanel?.clearHighlight()
          this.blocklyPanel?.clearHighlight()
          this._highlightDirection = null
        }
        return
      }
      this.monacoPanel?.clearHighlight()
      this.blocklyPanel?.clearHighlight()
      this._highlightDirection = 'block-to-code'
      this.blocklyPanel?.highlightBlock(blockId, 'block-to-code')
      const mapping = this.syncController?.getMappingForBlock(blockId)
      if (mapping) {
        this.monacoPanel?.addHighlight(mapping.startLine + 1, mapping.endLine + 1, 'block-to-code')
      }
    })

    // Code → Block highlighting (green on both code and block)
    this.monacoPanel?.onCursorChange((line) => {
      this.blocklyPanel?.clearHighlight()
      this.monacoPanel?.clearHighlight()
      this._highlightDirection = 'code-to-block'
      // Deselect any Blockly-selected block so next block click fires SELECTED
      try {
        const selected = Blockly.getSelected()
        if (selected) {
          Blockly.common.setSelected(null as unknown as Blockly.ISelectable)
        }
      } catch { /* ignore */ }
      // Monaco lines are 1-based, SourceMapping is 0-based
      const mapping = this.syncController?.getMappingForLine(line - 1)
      if (mapping) {
        this.blocklyPanel?.highlightBlock(mapping.blockId, 'code-to-block')
        this.monacoPanel?.addHighlight(mapping.startLine + 1, mapping.endLine + 1, 'code-to-block')
      }
    })
  }

  private highlightMonacoLines(startLine: number, endLine: number): void {
    this.monacoPanel?.addHighlight(startLine, endLine)
  }

  private clearHighlights(): void {
    this.blocklyPanel?.clearHighlight()
  }

  private getWorkspaceVarOptions(): Array<[string, string]> {
    const options: Array<[string, string]> = []
    const seen = new Set<string>()
    const addOption = (name: string) => {
      if (name && !seen.has(name)) {
        seen.add(name)
        options.push([name, name])
      }
    }
    const workspace = this.blocklyPanel?.getWorkspace()
    if (workspace) {
      const blocks = workspace.getAllBlocks(false)
      for (const block of blocks) {
        if (block.type === 'u_var_declare') {
          // Scan indexed NAME fields
          for (let i = 0; ; i++) {
            const name = block.getFieldValue(`NAME_${i}`)
            if (name === null || name === undefined) break
            addOption(name)
          }
        } else if (block.type === 'u_func_def') {
          // Scan function parameters
          for (let i = 0; ; i++) {
            const name = block.getFieldValue(`PARAM_${i}`)
            if (name === null || name === undefined) break
            addOption(name)
          }
        } else if (block.type === 'u_count_loop') {
          addOption(block.getFieldValue('VAR'))
        } else if (block.type === 'u_input') {
          // Three-mode: scan SEL_i (select dropdown values)
          for (let i = 0; ; i++) {
            const sel = block.getFieldValue(`SEL_${i}`)
            if (sel !== null && sel !== undefined && sel !== '__COMPOSE__' && sel !== '__CUSTOM__') {
              addOption(sel)
              continue
            }
            // Legacy: NAME_i
            const name = block.getFieldValue(`NAME_${i}`)
            if (name !== null && name !== undefined) {
              addOption(name)
              continue
            }
            break
          }
        } else if (block.type === 'c_var_declare_expr') {
          // Expression-mode variable declaration (e.g. for-loop init: int j = ...)
          for (let i = 0; ; i++) {
            const name = block.getFieldValue(`NAME_${i}`)
            if (name === null || name === undefined) break
            addOption(name)
          }
        } else if (block.type === 'c_for_loop') {
          // Scan INIT input for inline var declarations
          const initBlock = block.getInputTargetBlock?.('INIT')
          if (initBlock && initBlock.type === 'c_var_declare_expr') {
            for (let i = 0; ; i++) {
              const name = initBlock.getFieldValue(`NAME_${i}`)
              if (name === null || name === undefined) break
              addOption(name)
            }
          }
        }
      }
    }
    if (options.length === 0) {
      options.push([Blockly.Msg['U_VAR_REF_CUSTOM'] || '(自訂)', 'x'])
    }
    return options
  }

  /** Like getWorkspaceVarOptions but display text shows & prefix for scanf */
  private getScanfVarOptions(): Array<[string, string]> {
    const options: Array<[string, string]> = []
    const seen = new Set<string>()
    const noAddrTypes = new Set(['string', 'char*', 'int*', 'float*', 'double*', 'void*'])

    const workspace = this.blocklyPanel?.getWorkspace()
    if (workspace) {
      const blocks = workspace.getAllBlocks(false)
      // First pass: collect variable types
      const varTypes = new Map<string, string>()
      const arrayVars = new Set<string>()
      for (const block of blocks) {
        if (block.type === 'u_var_declare') {
          const type = block.getFieldValue('TYPE') ?? 'int'
          for (let i = 0; ; i++) {
            const name = block.getFieldValue(`NAME_${i}`)
            if (name === null || name === undefined) break
            varTypes.set(name, type)
          }
        } else if (block.type === 'u_array_declare') {
          const name = block.getFieldValue('NAME')
          if (name) arrayVars.add(name)
        }
      }
      // Second pass: build options with & prefix
      const addOption = (name: string) => {
        if (!name || seen.has(name)) return
        seen.add(name)
        const type = varTypes.get(name)
        const needsAddr = !arrayVars.has(name) && (!type || !noAddrTypes.has(type))
        const display = needsAddr ? `&${name}` : name
        options.push([display, name])
      }
      for (const block of blocks) {
        if (block.type === 'u_var_declare') {
          for (let i = 0; ; i++) {
            const name = block.getFieldValue(`NAME_${i}`)
            if (name === null || name === undefined) break
            addOption(name)
          }
        } else if (block.type === 'u_array_declare') {
          addOption(block.getFieldValue('NAME'))
        } else if (block.type === 'u_func_def') {
          for (let i = 0; ; i++) {
            const name = block.getFieldValue(`PARAM_${i}`)
            if (name === null || name === undefined) break
            addOption(name)
          }
        } else if (block.type === 'u_count_loop') {
          addOption(block.getFieldValue('VAR'))
        }
      }
    }
    if (options.length === 0) {
      options.push(['&x', 'x'])
    }
    return options
  }

  /** Get array variable names from workspace, with optional currentVal fallback */
  private getWorkspaceArrayOptions(currentVal?: string): Array<[string, string]> {
    const options: Array<[string, string]> = []
    const seen = new Set<string>()
    const workspace = this.blocklyPanel?.getWorkspace()
    if (workspace) {
      for (const block of workspace.getAllBlocks(false)) {
        if (block.type === 'u_array_declare') {
          const name = block.getFieldValue('NAME')
          if (name && !seen.has(name)) {
            seen.add(name)
            options.push([name, name])
          }
        }
      }
    }
    // Ensure current value is always available as an option
    if (currentVal && !seen.has(currentVal)) {
      options.push([currentVal, currentVal])
    }
    if (options.length === 0) {
      options.push(['arr', 'arr'])
    }
    return options
  }

  /** Get function names from workspace, with optional currentVal fallback */
  private getWorkspaceFuncOptions(currentVal?: string): Array<[string, string]> {
    const options: Array<[string, string]> = []
    const seen = new Set<string>()
    const workspace = this.blocklyPanel?.getWorkspace()
    if (workspace) {
      for (const block of workspace.getAllBlocks(false)) {
        if (block.type === 'u_func_def') {
          const name = block.getFieldValue('NAME')
          if (name && !seen.has(name)) {
            seen.add(name)
            options.push([name, name])
          }
        }
      }
    }
    // Ensure currentVal is always available (for code→blocks sync of external functions)
    if (currentVal && !seen.has(currentVal)) {
      options.unshift([currentVal, currentVal])
    }
    if (options.length === 0) {
      options.push(['myFunction', 'myFunction'])
    }
    return options
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
      this.syncController?.syncCodeToBlocks()
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
    // If turning on, sync immediately if dirty
    if (this.autoSync) {
      if (this.blocksDirty) {
        this.syncController?.syncBlocksToCode()
        this.blocksDirty = false
        this.updateSyncHints()
      }
      if (this.codeDirty) {
        this.syncController?.syncCodeToBlocks()
      }
    }
  }

  private resetExecution(): void {
    this.interpreter = null
    this.stepController?.stop()
    this.stepController = null
    this.stepRecords = []
    this.currentStepIndex = -1
    this.clearHighlights()
  }

  private runBlockDiagnostics(): void {
    const workspace = this.blocklyPanel?.getWorkspace()
    if (!workspace) return

    const allBlocks = workspace.getAllBlocks(false)

    // Clear previous warnings
    for (const block of allBlocks) {
      block.setWarningText(null)
    }

    // Adapt Blockly blocks to DiagnosticBlock interface
    const diagnosticBlocks: DiagnosticBlock[] = allBlocks.map(block => ({
      id: block.id,
      type: block.type,
      getFieldValue: (name: string) => block.getFieldValue(name),
      getInputTargetBlock: (name: string) => {
        const target = block.getInputTargetBlock(name)
        if (!target) return null
        return {
          id: target.id,
          type: target.type,
          getFieldValue: (n: string) => target.getFieldValue(n),
          getInputTargetBlock: () => null,
          getInput: (n: string) => target.getInput(n),
        }
      },
      getInput: (name: string) => block.getInput(name),
    }))

    const diagnostics = runDiagnostics(diagnosticBlocks)

    // Apply warnings to blocks
    for (const diag of diagnostics) {
      const block = workspace.getBlockById(diag.blockId)
      if (block) {
        const msg = Blockly.Msg[diag.message] || diag.message
        block.setWarningText(msg)
      }
    }
  }

  private showExecButtons(running: boolean, mode: 'running' | 'stepping' = 'running'): void {
    const runGroup = document.querySelector('.run-group') as HTMLElement | null
    if (runGroup) runGroup.style.display = running ? 'none' : ''

    // Floating debug toolbar
    if (running) {
      this.debugToolbar?.show(mode)
    } else {
      this.debugToolbar?.hide()
    }
  }

  /** Execute using the current runMode setting */
  private executeWithCurrentMode(): void {
    switch (this.runMode) {
      case 'run':
        this.handleRun()
        break
      case 'debug':
      case 'step':
        this.handleStep()
        break
      case 'animate-slow':
      case 'animate-medium':
      case 'animate-fast': {
        const speedMap = { 'animate-slow': 'slow', 'animate-medium': 'medium', 'animate-fast': 'fast' } as const
        this.handleAnimate(speedMap[this.runMode])
        break
      }
    }
  }

  // Animation state for pause/accelerate support
  private animatePaused = false
  private animateResolve: (() => void) | null = null
  private animateSpeed: ExecutionSpeed = 'medium'
  private animateAccelerateSkipIds: Set<string> | null = null

  private static readonly ANIMATE_DELAY: Record<string, number> = {
    slow: 800,
    medium: 300,
    fast: 50,
  }

  /** Animate mode: real-time execution with step-by-step display */
  private async handleAnimate(speed: ExecutionSpeed): Promise<void> {
    // If already animating and paused, resume
    if (this.animatePaused && this.animateResolve) {
      this.animatePaused = false
      this.animateSpeed = speed
      this.debugToolbar?.setMode('running')
      this.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_RUNNING'] || 'Running', 'running')
      this.animateResolve()
      return
    }

    if (this.blocksDirty) {
      const sync = confirm(Blockly.Msg['EXEC_UNSYNC_PROMPT'] || 'Blocks have changed. Sync before running?')
      if (sync) {
        this.syncController?.syncBlocksToCode()
      }
    }

    const tree = this.blocklyPanel?.extractSemanticTree()
    if (!tree) return

    this.resetExecution()
    this.animatePaused = false
    this.animateResolve = null
    this.animateSpeed = speed
    this.animateAccelerateSkipIds = null

    this.interpreter = new SemanticInterpreter({ maxSteps: 10_000_000 })
    this.interpreter.setInputProvider(() => this.consolePanel!.promptInput())
    this.interpreter.setOutputCallback((text: string) => {
      this.consolePanel?.write(text)
    })
    this.interpreter.setWaitingCallback((blockId) => {
      this.blocklyPanel?.clearHighlight()
      if (blockId && this.blocklyPanel?.getWorkspace()) {
        this.blocklyPanel.highlightBlock(blockId, 'execution')
        this.blocklyPanel.getWorkspace()!.centerOnBlock(blockId)
        const mapping = this.syncController?.getMappingForBlock(blockId)
        if (mapping && this.monacoPanel) {
          this.highlightMonacoLines(mapping.startLine + 1, mapping.endLine + 1)
          this.monacoPanel.revealLine(mapping.startLine + 1)
        }
      }
    })

    // Real-time step display with delay
    this.stepRecords = []
    this.currentStepIndex = -1
    this.interpreter.setRecordSteps(true)
    this.interpreter.setStepRecordCallback(async (step: StepInfo) => {
      this.stepRecords.push(step)
      this.currentStepIndex = this.stepRecords.length - 1

      // If accelerating past a block, skip display and delay
      if (this.animateAccelerateSkipIds && step.blockId && this.animateAccelerateSkipIds.has(step.blockId)) {
        return
      }
      this.animateAccelerateSkipIds = null

      this.displayStep(this.currentStepIndex)

      // Check breakpoints
      let shouldPause = this.animatePaused
      if (!shouldPause && step.blockId) {
        const mapping = this.syncController?.getMappingForBlock(step.blockId)
        if (mapping) {
          const breakpoints = this.monacoPanel?.getBreakpoints() ?? []
          const hitBreakpoint = breakpoints.some(bp => bp >= mapping.startLine + 1 && bp <= mapping.endLine + 1)
          if (hitBreakpoint) {
            shouldPause = true
            this.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_PAUSED'] || 'Paused (breakpoint)', 'running')
          }
        }
      }

      // Pause (user-initiated or breakpoint)
      if (shouldPause) {
        this.animatePaused = true
        this.debugToolbar?.setMode('paused')
        await new Promise<void>(resolve => { this.animateResolve = resolve })
        this.animateResolve = null
        return
      }

      // Animation delay
      const delay = App.ANIMATE_DELAY[this.animateSpeed]
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    })

    this.consolePanel?.clear()
    this.bottomPanel?.showTab('variables')
    this.showExecButtons(true, 'running')
    this.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_RUNNING'] || 'Running', 'running')

    try {
      await this.interpreter.execute(tree as unknown as InterpreterNode)
      this.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_COMPLETED'] || 'Completed', 'completed')
    } catch (e) {
      if (e instanceof RuntimeError) {
        if (e.i18nKey === 'RUNTIME_ERR_ABORTED') {
          this.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_ABORTED'] || 'Interrupted', '')
        } else {
          this.consolePanel?.error(e.message)
          this.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_ERROR'] || 'Error', 'error')
        }
      } else {
        this.consolePanel?.error(String(e))
        this.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_ERROR'] || 'Error', 'error')
      }
    } finally {
      this.clearHighlights()
      this.showExecButtons(false)
    }
  }

  private updateRunButtonLabel(): void {
    const btn = document.getElementById('run-btn')
    if (!btn) return
    const labels: Record<string, string> = {
      'run': '▶ 執行',
      'debug': '🔍 除錯',
      'animate-slow': '▷ 動畫（慢）',
      'animate-medium': '▷ 動畫（中）',
      'animate-fast': '▷ 動畫（快）',
      'step': '⏭ 逐步',
    }
    btn.textContent = labels[this.runMode] ?? '▶ 執行'
  }

  private updateRunModeMenu(): void {
    const menu = document.getElementById('run-mode-menu')
    if (!menu) return
    menu.querySelectorAll('.run-mode-option').forEach(el => {
      const opt = el as HTMLElement
      opt.classList.toggle('active', opt.dataset.mode === this.runMode)
    })
  }

  dispose(): void {
    this.blocklyPanel?.dispose()
    this.monacoPanel?.dispose()
    this.debugToolbar?.dispose()
  }
}
