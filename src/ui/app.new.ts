import * as Blockly from 'blockly'
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
import type { StepInfo, ExecutionSpeed } from '../interpreter/types'
import type { SemanticNode as InterpreterNode } from '../core/semantic-model'
import { RuntimeError } from '../interpreter/errors'
import { showToast } from './toolbar/toast'
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
import { LocaleSelector } from './toolbar/locale-selector'
import { isBlockAvailable } from '../core/cognitive-levels'
import type { StylePreset, BlockSpec, CognitiveLevel } from '../core/types'
import universalBlocks from '../blocks/universal.json'
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
  private stepRecords: StepInfo[] = []
  private currentStepIndex = -1
  private blocksDirty = false
  private quickAccessBar: QuickAccessBar | null = null
  private currentLevel: CognitiveLevel = 1
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
        <button id="sync-blocks-btn" title="積木 → 程式碼">積木→程式碼</button>
        <button id="sync-code-btn" title="程式碼 → 積木">程式碼→積木</button>
        <span class="toolbar-separator"></span>
        <span id="level-selector-mount"></span>
        <span class="toolbar-separator"></span>
        <span id="style-selector-mount"></span>
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
        <button id="run-btn" class="exec-btn run" title="執行">▶ 執行</button>
        <button id="step-btn" class="exec-btn" title="逐步">⏭ 逐步</button>
        <button id="pause-btn" class="exec-btn pause" title="暫停" style="display:none">⏸ 暫停</button>
        <button id="stop-btn" class="exec-btn stop" title="停止" style="display:none">⏹ 停止</button>
        <select id="speed-select" class="speed-select">
          <option value="slow">慢</option>
          <option value="medium" selected>中</option>
          <option value="fast">快</option>
        </select>
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
    statusBar.innerHTML = '<span>C++ | APCS Style | zh-TW</span>'
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
    this.bottomPanel.addTab({ id: 'console', label: Blockly.Msg['PANEL_CONSOLE'] || 'Console', panel: consoleEl })

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
      this.syncController!.syncBlocksToCode()
      this.blocksDirty = false
      this.updateSyncHints()
      this.runBlockDiagnostics()
      this.autoSave()
    })

    // Code change detection for sync hint
    this.monacoPanel.onChange(() => {
      this.updateSyncHints()
    })

    // 10. Setup toolbar buttons + selectors + execution + highlighting
    this.setupToolbar()
    this.setupExecution()
    this.setupBidirectionalHighlight()
    this.setupLevelSelector()
    this.setupStyleSelector()
    this.setupLocaleSelector()

    // 11. Restore saved state
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
    const setMinusState = (block: any, isAtMin: boolean) => {
      const f = block.getField('MINUS_BTN')
      if (f) f.setValue(isAtMin ? MINUS_DISABLED_IMG : MINUS_IMG)
    }

    // u_var_declare with +/- buttons + inline layout
    {
      const getTypeOptions = () => {
        return [
          [Blockly.Msg['TYPE_INT'] || 'int', 'int'],
          [Blockly.Msg['TYPE_FLOAT'] || 'float', 'float'],
          [Blockly.Msg['TYPE_DOUBLE'] || 'double', 'double'],
          [Blockly.Msg['TYPE_CHAR'] || 'char', 'char'],
          [Blockly.Msg['TYPE_BOOL'] || 'bool', 'bool'],
          [Blockly.Msg['TYPE_STRING'] || 'string', 'string'],
          [Blockly.Msg['TYPE_LONG_LONG'] || 'long long', 'long long'],
        ] as Array<[string, string]>
      }

      // Mutator helper blocks for u_var_declare
      Blockly.Blocks['u_var_declare_container'] = {
        init: function (this: Blockly.Block) {
          this.appendDummyInput().appendField(Blockly.Msg['U_VAR_DECLARE_HEADER'] || '宣告')
          this.appendStatementInput('STACK')
          this.setColour('#FF8C1A')
          this.contextMenu = false
        },
      }
      Blockly.Blocks['u_var_declare_var_input'] = {
        init: function (this: Blockly.Block) {
          this.appendDummyInput().appendField(Blockly.Msg['U_VAR_DECLARE_VAR_LABEL'] || '變數')
          this.setPreviousStatement(true)
          this.setNextStatement(true)
          this.setColour('#FF8C1A')
          this.contextMenu = false
        },
      }
      Blockly.Blocks['u_var_declare_var_init_input'] = {
        init: function (this: Blockly.Block) {
          this.appendDummyInput().appendField(Blockly.Msg['U_VAR_DECLARE_VAR_INIT_LABEL'] || '變數 = 值')
          this.setPreviousStatement(true)
          this.setNextStatement(true)
          this.setColour('#FF8C1A')
          this.contextMenu = false
        },
      }

      Blockly.Blocks['u_var_declare'] = {
        items_: ['var_init'] as string[],
        init: function (this: any) {
          this.items_ = ['var_init']
          this.appendDummyInput('HEADER')
            .appendField(Blockly.Msg['U_VAR_DECLARE_HEADER'] || '宣告')
            .appendField(new Blockly.FieldDropdown(getTypeOptions) as Blockly.Field, 'TYPE')
          this.appendValueInput('INIT_0')
            .appendField(new Blockly.FieldTextInput('x') as Blockly.Field, 'NAME_0')
            .appendField('=')
          this.appendDummyInput('TAIL')
            .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plus_()))
            .appendField(new Blockly.FieldImage(MINUS_DISABLED_IMG, 20, 20, '-', () => this.minus_()), 'MINUS_BTN')
          this.setInputsInline(true)
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setColour('#FF8C1A')
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
          this.setColour('#5CB1D6')
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

    // u_input with +/- buttons + inline layout
    {
      Blockly.Blocks['u_input'] = {
        varCount_: 1,
        init: function (this: any) {
          this.varCount_ = 1
          this.appendDummyInput('VAR_0')
            .appendField(Blockly.Msg['U_INPUT_MSG'] || '輸入')
            .appendField(new Blockly.FieldTextInput('x') as Blockly.Field, 'NAME_0')
          this.appendDummyInput('TAIL')
            .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plus_()))
            .appendField(new Blockly.FieldImage(MINUS_DISABLED_IMG, 20, 20, '-', () => this.minus_()), 'MINUS_BTN')
          this.setInputsInline(true)
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setColour('#5CB1D6')
          this.setTooltip(Blockly.Msg['U_INPUT_TOOLTIP'] || '讀取輸入')
        },
        plus_: function (this: any) {
          this.appendDummyInput('VAR_' + this.varCount_)
            .appendField(new Blockly.FieldTextInput('v' + this.varCount_) as Blockly.Field, 'NAME_' + this.varCount_)
          this.moveInputBefore('VAR_' + this.varCount_, 'TAIL')
          this.varCount_++
          setMinusState(this, false)
        },
        minus_: function (this: any) {
          if (this.varCount_ <= 1) return
          this.varCount_--
          this.removeInput('VAR_' + this.varCount_)
          setMinusState(this, this.varCount_ <= 1)
        },
        saveExtraState: function (this: any) {
          if (this.varCount_ <= 1) return null
          return { varCount: this.varCount_ }
        },
        loadExtraState: function (this: any, state: { varCount?: number }) {
          const count = state?.varCount ?? 1
          while (this.varCount_ < count) {
            this.plus_()
          }
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
          this.setColour('#5CB1D6')
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
          this.setColour('#FFAB19')
          this.contextMenu = false
        },
      }
      Blockly.Blocks['u_if_elseif_input'] = {
        init: function (this: Blockly.Block) {
          this.appendDummyInput().appendField(Blockly.Msg['U_IF_ELSE_ELSEIF_MSG'] || '否則，如果')
          this.setPreviousStatement(true)
          this.setNextStatement(true)
          this.setColour('#FFAB19')
          this.contextMenu = false
        },
      }
      Blockly.Blocks['u_if_else_input'] = {
        init: function (this: Blockly.Block) {
          this.appendDummyInput().appendField(Blockly.Msg['U_IF_ELSE_MSG2'] || '否則')
          this.setPreviousStatement(true)
          this.setColour('#FFAB19')
          this.contextMenu = false
        },
      }

      Blockly.Blocks['u_if'] = {
        elseifCount_: 0,
        hasElse_: false,
        init: function (this: any) {
          this.elseifCount_ = 0
          this.hasElse_ = false
          this.appendValueInput('CONDITION')
            .appendField(Blockly.Msg['U_IF_MSG'] || '如果')
          this.appendStatementInput('THEN')
            .appendField(Blockly.Msg['U_IF_THEN'] || '則')
          this.appendDummyInput('TAIL')
            .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plusElseIf_()))
            .appendField(new Blockly.FieldImage(MINUS_DISABLED_IMG, 20, 20, '-', () => this.minusElseIf_()), 'MINUS_BTN')
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setColour('#FFAB19')
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
          this.appendValueInput('CONDITION')
            .appendField(Blockly.Msg['U_WHILE_MSG'] || '當')
          this.appendStatementInput('BODY')
            .appendField(Blockly.Msg['U_WHILE_DO'] || '重複')
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setColour('#FFAB19')
          this.setTooltip(Blockly.Msg['U_WHILE_TOOLTIP'] || 'while 迴圈')
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
          this.appendValueInput('FROM')
            .appendField(Blockly.Msg['U_COUNT_LOOP_FROM'] || '從')
          this.appendValueInput('TO')
            .appendField(Blockly.Msg['U_COUNT_LOOP_TO'] || '到')
          this.appendStatementInput('BODY')
            .appendField(Blockly.Msg['U_COUNT_LOOP_DO'] || '重複')
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setColour('#FFAB19')
          this.setTooltip(Blockly.Msg['U_COUNT_LOOP_TOOLTIP'] || 'for 迴圈')
        },
      }
    }

    // u_break, u_continue
    {
      Blockly.Blocks['u_break'] = {
        init: function (this: Blockly.Block) {
          this.appendDummyInput().appendField(Blockly.Msg['U_BREAK_MSG'] || '跳出')
          this.setPreviousStatement(true, 'Statement')
          this.setColour('#FFAB19')
          this.setTooltip('break')
        },
      }
    }
    {
      Blockly.Blocks['u_continue'] = {
        init: function (this: Blockly.Block) {
          this.appendDummyInput().appendField(Blockly.Msg['U_CONTINUE_MSG'] || '繼續')
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setColour('#FFAB19')
          this.setTooltip('continue')
        },
      }
    }

    // u_func_def with +/- for parameters
    /* eslint-disable @typescript-eslint/no-explicit-any */
    {
      const PARAM_TYPE_OPTIONS = [
        ['int', 'int'], ['float', 'float'], ['double', 'double'],
        ['char', 'char'], ['bool', 'bool'], ['string', 'string'],
      ] as Array<[string, string]>

      Blockly.Blocks['u_func_def'] = {
        paramCount_: 0,
        init: function (this: any) {
          this.paramCount_ = 0
          this.appendDummyInput('HEADER')
            .appendField(Blockly.Msg['U_FUNC_DEF_MSG'] || '定義函式')
            .appendField(new Blockly.FieldDropdown([
              ['void', 'void'], ['int', 'int'], ['float', 'float'],
              ['double', 'double'], ['char', 'char'], ['bool', 'bool'],
              ['long long', 'long long'], ['string', 'string'],
            ]) as Blockly.Field, 'RETURN_TYPE')
            .appendField(new Blockly.FieldTextInput('main') as Blockly.Field, 'NAME')
          this.appendDummyInput('PARAMS_LABEL')
            .appendField('(')
          this.appendDummyInput('PARAMS_END')
            .appendField(')')
            .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plusParam_()))
            .appendField(new Blockly.FieldImage(MINUS_DISABLED_IMG, 20, 20, '-', () => this.minusParam_()), 'MINUS_BTN')
          this.appendStatementInput('BODY')
          this.setInputsInline(true)
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setColour('#FF6680')
          this.setTooltip(Blockly.Msg['U_FUNC_DEF_TOOLTIP'] || '定義函式')
        },
        plusParam_: function (this: any) {
          const idx = this.paramCount_
          const input = this.appendDummyInput(`PARAM_${idx}`)
          if (idx > 0) input.appendField(',')
          input.appendField(new Blockly.FieldDropdown(PARAM_TYPE_OPTIONS) as Blockly.Field, `TYPE_${idx}`)
          input.appendField(new Blockly.FieldTextInput(`p${idx}`) as Blockly.Field, `PARAM_${idx}`)
          this.moveInputBefore(`PARAM_${idx}`, 'PARAMS_END')
          this.paramCount_++
          setMinusState(this, false)
        },
        minusParam_: function (this: any) {
          if (this.paramCount_ <= 0) return
          this.paramCount_--
          this.removeInput(`PARAM_${this.paramCount_}`)
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
          this.argCount_ = 0
          this.appendDummyInput('LABEL')
            .appendField(Blockly.Msg['U_FUNC_CALL_MSG'] || '呼叫')
            .appendField(new Blockly.FieldTextInput('myFunction') as Blockly.Field, 'NAME')
            .appendField('(')
          this.appendDummyInput('TAIL')
            .appendField(')')
            .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plusArg_()))
            .appendField(new Blockly.FieldImage(MINUS_DISABLED_IMG, 20, 20, '-', () => this.minusArg_()), 'MINUS_BTN')
          this.setInputsInline(true)
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setColour('#FF6680')
          this.setTooltip(Blockly.Msg['U_FUNC_CALL_TOOLTIP'] || '呼叫函式')
        },
        plusArg_: function (this: any) {
          const idx = this.argCount_
          this.appendValueInput(`ARG_${idx}`)
            .appendField(idx > 0 ? ',' : '')
          this.moveInputBefore(`ARG_${idx}`, 'TAIL')
          this.argCount_++
          setMinusState(this, false)
        },
        minusArg_: function (this: any) {
          if (this.argCount_ <= 0) return
          this.argCount_--
          this.removeInput(`ARG_${this.argCount_}`)
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
            .appendField(Blockly.Msg['U_FUNC_CALL_MSG'] || '呼叫')
            .appendField(new Blockly.FieldTextInput('myFunction') as Blockly.Field, 'NAME')
            .appendField('(')
          this.appendDummyInput('TAIL')
            .appendField(')')
            .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plusArg_()))
            .appendField(new Blockly.FieldImage(MINUS_DISABLED_IMG, 20, 20, '-', () => this.minusArg_()), 'MINUS_BTN')
          this.setInputsInline(true)
          this.setOutput(true, 'Expression')
          this.setColour('#FF6680')
          this.setTooltip(Blockly.Msg['U_FUNC_CALL_EXPR_TOOLTIP'] || '呼叫函式（回傳值）')
        },
        plusArg_: function (this: any) {
          const idx = this.argCount_
          this.appendValueInput(`ARG_${idx}`)
            .appendField(idx > 0 ? ',' : '')
          this.moveInputBefore(`ARG_${idx}`, 'TAIL')
          this.argCount_++
          setMinusState(this, false)
        },
        minusArg_: function (this: any) {
          if (this.argCount_ <= 0) return
          this.argCount_--
          this.removeInput(`ARG_${this.argCount_}`)
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
          this.setColour('#FF6680')
          this.setTooltip(Blockly.Msg['U_RETURN_TOOLTIP'] || '回傳值')
        },
      }
    }

    // u_var_ref with dynamic dropdown from workspace declarations
    {
      const self = this
      Blockly.Blocks['u_var_ref'] = {
        init: function (this: Blockly.Block) {
          const block = this
          this.appendDummyInput()
            .appendField(new Blockly.FieldDropdown(function () {
              const opts = self.getWorkspaceVarOptions()
              // Ensure current value is in the options (for function params, etc.)
              const currentVal = block.getFieldValue('NAME')
              if (currentVal && !opts.some(o => o[1] === currentVal)) {
                opts.unshift([currentVal, currentVal])
              }
              return opts
            }) as Blockly.Field, 'NAME')
          this.setOutput(true, 'Expression')
          this.setColour('#FF8C1A')
          this.setTooltip(Blockly.Msg['U_VAR_REF_TOOLTIP'] || '使用變數的值')
        },
      }
    }

    // u_array_declare — SIZE as input_value (allows expressions)
    {
      Blockly.Blocks['u_array_declare'] = {
        init: function (this: Blockly.Block) {
          this.appendDummyInput()
            .appendField(Blockly.Msg['U_ARRAY_DECLARE_MSG'] || '陣列')
            .appendField(new Blockly.FieldDropdown([
              ['int', 'int'], ['float', 'float'], ['double', 'double'],
              ['char', 'char'], ['bool', 'bool'], ['long long', 'long long'],
            ]) as Blockly.Field, 'TYPE')
            .appendField(new Blockly.FieldTextInput('arr') as Blockly.Field, 'NAME')
          this.appendValueInput('SIZE')
            .appendField('[')
            .setCheck('Expression')
          this.appendDummyInput()
            .appendField(']')
          this.setInputsInline(true)
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setColour('#FF661A')
          this.setTooltip(Blockly.Msg['U_ARRAY_DECLARE_TOOLTIP'] || '宣告陣列')
        },
      }
    }

    // c_raw_code — with unresolved visual distinction
    {
      Blockly.Blocks['c_raw_code'] = {
        init: function (this: Blockly.Block) {
          this.appendDummyInput()
            .appendField(new Blockly.FieldTextInput('// raw code') as Blockly.Field, 'CODE')
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setColour('#888888')
          this.setTooltip('Raw code')
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
            this.setColour('#AA6644')
            this.setTooltip(`Unresolved: ${this.nodeType_}`)
          }
        },
      }
    }

    // u_array_access
    {
      Blockly.Blocks['u_array_access'] = {
        init: function (this: Blockly.Block) {
          this.appendValueInput('INDEX')
            .appendField(new Blockly.FieldTextInput('arr') as Blockly.Field, 'NAME')
            .appendField('[')
          this.appendDummyInput()
            .appendField(']')
          this.setInputsInline(true)
          this.setOutput(true, 'Expression')
          this.setColour('#FF661A')
          this.setTooltip(Blockly.Msg['U_ARRAY_ACCESS_TOOLTIP'] || '陣列存取')
        },
      }
    }

    // c_comment_line
    {
      Blockly.Blocks['c_comment_line'] = {
        init: function (this: Blockly.Block) {
          this.appendDummyInput()
            .appendField('//')
            .appendField(new Blockly.FieldTextInput('comment') as Blockly.Field, 'TEXT')
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setColour('#AAAAAA')
          this.setTooltip('Comment')
        },
      }
    }
  }

  private buildToolbox(level?: CognitiveLevel): object {
    const lv = level ?? this.currentLevel

    const filterBlocks = (types: string[]) =>
      types.filter(t => isBlockAvailable(t, lv)).map(t => ({ kind: 'block', type: t }))

    const categories = [
      {
        kind: 'category',
        name: Blockly.Msg['CATEGORY_DATA'] || '資料',
        colour: '#FF8C1A',
        contents: filterBlocks([
          'u_var_declare', 'u_var_assign', 'u_var_ref', 'u_number', 'u_string',
        ]),
      },
      {
        kind: 'category',
        name: Blockly.Msg['CATEGORY_OPERATORS'] || '運算',
        colour: '#59C059',
        contents: filterBlocks([
          'u_arithmetic', 'u_compare', 'u_logic', 'u_logic_not', 'u_negate',
        ]),
      },
      {
        kind: 'category',
        name: Blockly.Msg['CATEGORY_CONTROL'] || '控制',
        colour: '#FFAB19',
        contents: filterBlocks([
          'u_if', 'u_while_loop', 'u_count_loop', 'u_break', 'u_continue',
        ]),
      },
      {
        kind: 'category',
        name: Blockly.Msg['CATEGORY_FUNCTIONS'] || '函式',
        colour: '#FF6680',
        contents: filterBlocks([
          'u_func_def', 'u_func_call', 'u_func_call_expr', 'u_return',
        ]),
      },
      {
        kind: 'category',
        name: Blockly.Msg['CATEGORY_IO'] || '輸入/輸出',
        colour: '#5CB1D6',
        contents: filterBlocks([
          'u_print', 'u_input', 'u_endl',
        ]),
      },
      {
        kind: 'category',
        name: Blockly.Msg['CATEGORY_ARRAYS'] || '陣列',
        colour: '#FF661A',
        contents: filterBlocks([
          'u_array_declare', 'u_array_access',
        ]),
      },
      // ─── C++ Lang-Core (L1) ───
      {
        kind: 'category',
        name: 'C++ 基礎',
        colour: '#59C059',
        contents: filterBlocks([
          'c_char_literal', 'c_increment', 'c_compound_assign',
          'c_for_loop', 'c_do_while', 'c_switch', 'c_case',
        ]),
      },
      {
        kind: 'category',
        name: 'C++ 輸入/輸出',
        colour: '#5CB1D6',
        contents: filterBlocks([
          'c_printf', 'c_scanf',
        ]),
      },
      // ─── C++ Advanced (L2) ───
      {
        kind: 'category',
        name: 'C++ 指標',
        colour: '#9966FF',
        contents: filterBlocks([
          'c_pointer_declare', 'c_pointer_deref', 'c_address_of',
          'c_malloc', 'c_free',
        ]),
      },
      {
        kind: 'category',
        name: 'C++ 結構/類別',
        colour: '#CF63CF',
        contents: filterBlocks([
          'c_struct_declare', 'c_struct_member_access', 'c_struct_pointer_access',
          'cpp_class_def', 'cpp_new', 'cpp_delete', 'cpp_template_function',
        ]),
      },
      {
        kind: 'category',
        name: 'C++ 字串',
        colour: '#0FBD8C',
        contents: filterBlocks([
          'c_strlen', 'c_strcmp', 'c_strcpy', 'cpp_string_declare',
        ]),
      },
      {
        kind: 'category',
        name: 'C++ 容器',
        colour: '#4C97FF',
        contents: filterBlocks([
          'cpp_vector_declare', 'cpp_vector_push_back', 'cpp_vector_size',
          'cpp_map_declare', 'cpp_stack_declare', 'cpp_queue_declare', 'cpp_set_declare',
          'cpp_method_call', 'cpp_method_call_expr',
        ]),
      },
      {
        kind: 'category',
        name: 'C++ 演算法',
        colour: '#4C97FF',
        contents: filterBlocks([
          'cpp_sort',
        ]),
      },
      {
        kind: 'category',
        name: 'C++ 特殊',
        colour: '#888888',
        contents: filterBlocks([
          'c_raw_code', 'c_raw_expression', 'c_comment_line',
          'c_include', 'c_include_local', 'c_define',
          'c_ifdef', 'c_ifndef', 'c_using_namespace',
        ]),
      },
    ]

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
    pl.loadBlockSpecs(allSpecs)
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
        // Clear flag after event loop settles (deferred Blockly events)
        setTimeout(() => { this._codeToBlocksInProgress = false }, 0)
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
    })
  }

  private setupStyleSelector(): void {
    const mount = document.getElementById('style-selector-mount')
    if (!mount) return
    const selector = new StyleSelector(mount, STYLE_PRESETS)
    selector.onChange((style) => {
      this.syncController?.setStyle(style)
      this.syncController?.syncBlocksToCode()
      this.updateStatusBar(style)
    })
  }

  private setupLocaleSelector(): void {
    const mount = document.getElementById('locale-selector-mount')
    if (!mount) return
    const selector = new LocaleSelector(mount)
    selector.onChange(async (locale) => {
      await this.localeLoader.load(locale)
      // Re-render blocks to update messages
      this.syncController?.syncBlocksToCode()
    })
  }

  private updateStatusBar(style?: StylePreset): void {
    const statusBar = document.getElementById('status-bar')
    if (!statusBar) return
    const s = style ?? DEFAULT_STYLE
    const styleName = s.name['zh-TW'] || s.id
    statusBar.innerHTML = `<span>C++ | ${styleName}</span>`
  }

  private updateToolboxForLevel(level: CognitiveLevel): void {
    if (!this.blocklyPanel) return
    const workspace = this.blocklyPanel.getWorkspace()
    if (!workspace) return
    const toolbox = this.buildToolbox(level)
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

    replaceBtn('sync-blocks-btn')?.addEventListener('click', () => {
      this.syncController?.syncBlocksToCode()
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
      styleId: 'apcs',
      level: this.currentLevel,
      lastModified: new Date().toISOString(),
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

    replaceBtn('run-btn')?.addEventListener('click', () => this.handleRun())
    replaceBtn('step-btn')?.addEventListener('click', () => this.handleStep())
    replaceBtn('pause-btn')?.addEventListener('click', () => this.handlePause())
    replaceBtn('stop-btn')?.addEventListener('click', () => this.handleStop())

    const speedSelect = document.getElementById('speed-select') as HTMLSelectElement | null
    speedSelect?.addEventListener('change', () => {
      this.stepController?.setSpeed(speedSelect.value as ExecutionSpeed)
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
    this.interpreter = new SemanticInterpreter({ maxSteps: 100000 })
    this.interpreter.setInputProvider(() => this.consolePanel!.promptInput())
    // Real-time output: stream to console as interpreter writes
    this.interpreter.setOutputCallback((text: string) => {
      this.consolePanel?.log(text)
    })

    this.showExecButtons(true)
    this.consolePanel?.clear()
    this.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_RUNNING'] || 'Running', 'running')
    this.bottomPanel?.activateTab('console')

    try {
      await this.interpreter.execute(tree as unknown as InterpreterNode)
      this.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_COMPLETED'] || 'Completed', 'completed')
      showToast(Blockly.Msg['TOAST_EXEC_COMPLETE'] || 'Program completed', 'success')
    } catch (e) {
      if (e instanceof RuntimeError) {
        this.consolePanel?.error(e.message)
        this.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_ERROR'] || 'Error', 'error')
        showToast(Blockly.Msg['TOAST_EXEC_ERROR'] || 'Execution error', 'error')
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
    this.interpreter = new SemanticInterpreter({ maxSteps: 100000 })
    // Real-time output: stream to console as interpreter writes during step collection
    this.interpreter.setOutputCallback((text: string) => {
      this.consolePanel?.log(text)
    })
    this.consolePanel?.clear()
    this.bottomPanel?.activateTab('variables')
    this.showExecButtons(true)

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
    this.bottomPanel?.activateTab('variables')

    // Highlight block
    this.clearHighlights()
    if (step.blockId && this.blocklyPanel?.getWorkspace()) {
      const block = this.blocklyPanel.getWorkspace()!.getBlockById(step.blockId)
      if (block) {
        block.addSelect()
      }
    }

    // Highlight code line via source mapping
    if (step.blockId) {
      const mapping = this.syncController?.getMappingForBlock(step.blockId)
      if (mapping && this.monacoPanel) {
        // Monaco uses 1-based lines
        this.highlightMonacoLines(mapping.startLine + 1, mapping.endLine + 1)
      }
    }

    // Update console output up to this step
    // (show only output lines up to step.outputLength)

    if (this.stepController?.getStatus() === 'completed') {
      this.consolePanel?.setStatus(Blockly.Msg['EXEC_STATUS_COMPLETED'] || 'Completed', 'completed')
      this.showExecButtons(false)
    }
  }

  private setupBidirectionalHighlight(): void {
    // Block → Code highlighting
    this.blocklyPanel?.onBlockSelect((blockId) => {
      this.monacoPanel?.clearHighlight()
      if (!blockId) return
      const mapping = this.syncController?.getMappingForBlock(blockId)
      if (mapping) {
        this.monacoPanel?.addHighlight(mapping.startLine + 1, mapping.endLine + 1)
      }
    })

    // Code → Block highlighting
    this.monacoPanel?.onCursorChange((line) => {
      this.blocklyPanel?.clearHighlight()
      // Monaco lines are 1-based, SourceMapping is 0-based
      const mapping = this.syncController?.getMappingForLine(line - 1)
      if (mapping) {
        this.blocklyPanel?.highlightBlock(mapping.blockId)
      }
    })
  }

  private highlightMonacoLines(startLine: number, endLine: number): void {
    this.monacoPanel?.addHighlight(startLine, endLine)
  }

  private clearHighlights(): void {
    // Clear blockly selection
    const workspace = this.blocklyPanel?.getWorkspace()
    if (workspace) {
      const blocks = workspace.getAllBlocks(false)
      for (const block of blocks) {
        block.removeSelect()
      }
    }
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
          for (let i = 0; ; i++) {
            const name = block.getFieldValue(`NAME_${i}`)
            if (name === null || name === undefined) break
            addOption(name)
          }
        }
      }
    }
    if (options.length === 0) {
      options.push([Blockly.Msg['U_VAR_REF_CUSTOM'] || '(自訂)', 'x'])
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
      // Code-side dirty detection: simple approach — mark dirty when user types
      // Cleared when syncCodeToBlocks is called
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

  private showExecButtons(running: boolean): void {
    const pause = document.getElementById('pause-btn')
    const stop = document.getElementById('stop-btn')
    const run = document.getElementById('run-btn')
    const step = document.getElementById('step-btn')
    if (pause) pause.style.display = running ? '' : 'none'
    if (stop) stop.style.display = running ? '' : 'none'
    if (run) run.style.display = running ? 'none' : ''
    if (step) step.style.display = running ? 'none' : ''
  }

  dispose(): void {
    this.blocklyPanel?.dispose()
    this.monacoPanel?.dispose()
  }
}
