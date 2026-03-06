import * as Blockly from 'blockly'
import { BlocklyPanel } from './panels/blockly-panel'
import { MonacoPanel } from './panels/monaco-panel'
import { SplitPane } from './layout/split-pane'
import { SyncController } from './sync-controller'
import { registerCppLanguage } from '../languages/cpp/generators'
import { BlockSpecRegistry } from '../core/block-spec-registry'
import { LocaleLoader } from '../i18n/loader'
import type { StylePreset, BlockSpec } from '../core/types'
import universalBlocks from '../blocks/universal.json'

const DEFAULT_STYLE: StylePreset = {
  id: 'apcs',
  name: { 'zh-TW': 'APCS 風格', en: 'APCS Style' },
  io_style: 'cout',
  naming_convention: 'camelCase',
  indent_size: 4,
  brace_style: 'K&R',
  namespace_style: 'using',
  header_style: 'individual',
}

export class App {
  private blocklyPanel: BlocklyPanel | null = null
  private monacoPanel: MonacoPanel | null = null
  private syncController: SyncController | null = null
  private blockSpecRegistry: BlockSpecRegistry
  private localeLoader: LocaleLoader

  constructor() {
    this.blockSpecRegistry = new BlockSpecRegistry()
    this.localeLoader = new LocaleLoader()
  }

  async init(): Promise<void> {
    // 1. Register C++ code generators
    registerCppLanguage()

    // 2. Load locale
    this.localeLoader.setBlocklyMsg(Blockly.Msg as Record<string, string>)
    await this.localeLoader.load('zh-TW')

    // 3. Load block specs
    this.blockSpecRegistry.loadFromJSON(universalBlocks as unknown as BlockSpec[])

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
        <span class="toolbar-separator"></span>
        <button id="undo-btn" title="復原">↩</button>
        <button id="redo-btn" title="重做">↪</button>
        <button id="clear-btn" title="清空">清空</button>
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

    // 6. Initialize Blockly panel
    const blocklyContainer = splitPane.getLeftPanel()
    blocklyContainer.id = 'blockly-panel'
    this.blocklyPanel = new BlocklyPanel({ container: blocklyContainer })
    this.blocklyPanel.init(this.buildToolbox())

    // 7. Initialize Monaco panel
    const monacoContainer = splitPane.getRightPanel()
    monacoContainer.id = 'monaco-panel'
    this.monacoPanel = new MonacoPanel(monacoContainer)
    this.monacoPanel.init(true) // read-only for US1

    // 8. Create sync controller
    this.syncController = new SyncController(
      this.blocklyPanel,
      this.monacoPanel,
      'cpp',
      DEFAULT_STYLE,
    )

    // 9. Wire events
    this.blocklyPanel.onChange(() => {
      this.syncController!.syncBlocksToCode()
      this.autoSave()
    })

    // 10. Setup toolbar buttons
    this.setupToolbar()

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
    // u_var_declare with mutator gear
    if (!Blockly.Blocks['u_var_declare']) {
      const getTypeOptions = () => {
        return [
          [Blockly.Msg['TYPE_INT'] || 'int', 'int'],
          [Blockly.Msg['TYPE_FLOAT'] || 'float', 'float'],
          [Blockly.Msg['TYPE_DOUBLE'] || 'double', 'double'],
          [Blockly.Msg['TYPE_CHAR'] || 'char', 'char'],
          [Blockly.Msg['TYPE_BOOL'] || 'bool', 'bool'],
          [Blockly.Msg['TYPE_STRING'] || 'string', 'string'],
        ] as Array<[string, string]>
      }

      Blockly.Blocks['u_var_declare'] = {
        init: function (this: Blockly.Block) {
          this.appendDummyInput('HEADER')
            .appendField(Blockly.Msg['U_VAR_DECLARE_HEADER'] || '宣告')
            .appendField(new Blockly.FieldDropdown(getTypeOptions) as Blockly.Field, 'TYPE')
          this.appendValueInput('INIT_0')
            .appendField(new Blockly.FieldTextInput('x') as Blockly.Field, 'NAME_0')
            .appendField('=')
          this.setInputsInline(false)
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setColour('#FF8C1A')
          this.setTooltip(Blockly.Msg['U_VAR_DECLARE_TOOLTIP'] || '宣告變數')
        },
      }
    }

    // u_print with dynamic inputs
    if (!Blockly.Blocks['u_print']) {
      Blockly.Blocks['u_print'] = {
        itemCount_: 1,
        init: function (this: Blockly.Block & { itemCount_: number; updateShape_: () => void }) {
          this.appendValueInput('EXPR0')
            .appendField(Blockly.Msg['U_PRINT_MSG'] || '輸出')
          this.setInputsInline(true)
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setColour('#5CA65C')
          this.setTooltip(Blockly.Msg['U_PRINT_TOOLTIP'] || '輸出值')
        },
        saveExtraState: function (this: Blockly.Block & { itemCount_: number }) {
          return { itemCount: this.itemCount_ }
        },
        loadExtraState: function (this: Blockly.Block & { itemCount_: number; updateShape_: () => void }, state: { itemCount: number }) {
          this.itemCount_ = state.itemCount ?? 1
          this.updateShape_()
        },
        updateShape_: function (this: Blockly.Block & { itemCount_: number }) {
          // Remove excess inputs
          let i = this.itemCount_
          while (this.getInput(`EXPR${i}`)) {
            this.removeInput(`EXPR${i}`)
            i++
          }
          // Add missing inputs
          for (let j = 1; j < this.itemCount_; j++) {
            if (!this.getInput(`EXPR${j}`)) {
              this.appendValueInput(`EXPR${j}`)
            }
          }
        },
      }
    }

    // u_input
    if (!Blockly.Blocks['u_input']) {
      Blockly.Blocks['u_input'] = {
        init: function (this: Blockly.Block) {
          this.appendDummyInput()
            .appendField(Blockly.Msg['U_INPUT_MSG'] || '輸入')
            .appendField(new Blockly.FieldTextInput('x') as Blockly.Field, 'NAME_0')
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setColour('#5CA65C')
          this.setTooltip(Blockly.Msg['U_INPUT_TOOLTIP'] || '讀取輸入')
        },
      }
    }

    // u_endl
    if (!Blockly.Blocks['u_endl']) {
      Blockly.Blocks['u_endl'] = {
        init: function (this: Blockly.Block) {
          this.appendDummyInput()
            .appendField('endl')
          this.setOutput(true, 'Expression')
          this.setColour('#5CA65C')
          this.setTooltip(Blockly.Msg['U_ENDL_TOOLTIP'] || '換行')
        },
      }
    }

    // u_if with condition/then/else
    if (!Blockly.Blocks['u_if']) {
      Blockly.Blocks['u_if'] = {
        init: function (this: Blockly.Block) {
          this.appendValueInput('CONDITION')
            .appendField(Blockly.Msg['U_IF_MSG'] || '如果')
          this.appendStatementInput('THEN')
            .appendField(Blockly.Msg['U_IF_THEN'] || '則')
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setColour('#5B80A5')
          this.setTooltip(Blockly.Msg['U_IF_TOOLTIP'] || '條件判斷')
        },
      }
    }

    if (!Blockly.Blocks['u_if_else']) {
      Blockly.Blocks['u_if_else'] = {
        init: function (this: Blockly.Block) {
          this.appendValueInput('CONDITION')
            .appendField(Blockly.Msg['U_IF_MSG'] || '如果')
          this.appendStatementInput('THEN')
            .appendField(Blockly.Msg['U_IF_THEN'] || '則')
          this.appendStatementInput('ELSE')
            .appendField(Blockly.Msg['U_IF_ELSE'] || '否則')
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setColour('#5B80A5')
          this.setTooltip(Blockly.Msg['U_IF_ELSE_TOOLTIP'] || '條件判斷（含否則）')
        },
      }
    }

    // u_while_loop
    if (!Blockly.Blocks['u_while_loop']) {
      Blockly.Blocks['u_while_loop'] = {
        init: function (this: Blockly.Block) {
          this.appendValueInput('CONDITION')
            .appendField(Blockly.Msg['U_WHILE_MSG'] || '當')
          this.appendStatementInput('BODY')
            .appendField(Blockly.Msg['U_WHILE_DO'] || '重複')
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setColour('#5B80A5')
          this.setTooltip(Blockly.Msg['U_WHILE_TOOLTIP'] || 'while 迴圈')
        },
      }
    }

    // u_count_loop
    if (!Blockly.Blocks['u_count_loop']) {
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
          this.setColour('#5B80A5')
          this.setTooltip(Blockly.Msg['U_COUNT_LOOP_TOOLTIP'] || 'for 迴圈')
        },
      }
    }

    // u_break, u_continue
    if (!Blockly.Blocks['u_break']) {
      Blockly.Blocks['u_break'] = {
        init: function (this: Blockly.Block) {
          this.appendDummyInput().appendField(Blockly.Msg['U_BREAK_MSG'] || '跳出')
          this.setPreviousStatement(true, 'Statement')
          this.setColour('#5B80A5')
          this.setTooltip('break')
        },
      }
    }
    if (!Blockly.Blocks['u_continue']) {
      Blockly.Blocks['u_continue'] = {
        init: function (this: Blockly.Block) {
          this.appendDummyInput().appendField(Blockly.Msg['U_CONTINUE_MSG'] || '繼續')
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setColour('#5B80A5')
          this.setTooltip('continue')
        },
      }
    }

    // u_func_def
    if (!Blockly.Blocks['u_func_def']) {
      Blockly.Blocks['u_func_def'] = {
        init: function (this: Blockly.Block) {
          this.appendDummyInput()
            .appendField(Blockly.Msg['U_FUNC_DEF_MSG'] || '函式')
            .appendField(new Blockly.FieldDropdown([
              ['void', 'void'], ['int', 'int'], ['float', 'float'],
              ['double', 'double'], ['bool', 'bool'], ['string', 'string'],
            ]) as Blockly.Field, 'RETURN_TYPE')
            .appendField(new Blockly.FieldTextInput('myFunction') as Blockly.Field, 'NAME')
            .appendField('()')
          this.appendStatementInput('BODY')
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setColour('#995BA5')
          this.setTooltip(Blockly.Msg['U_FUNC_DEF_TOOLTIP'] || '定義函式')
        },
      }
    }

    // u_func_call
    if (!Blockly.Blocks['u_func_call']) {
      Blockly.Blocks['u_func_call'] = {
        init: function (this: Blockly.Block) {
          this.appendDummyInput()
            .appendField(Blockly.Msg['U_FUNC_CALL_MSG'] || '呼叫')
            .appendField(new Blockly.FieldTextInput('myFunction') as Blockly.Field, 'NAME')
            .appendField('()')
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setColour('#995BA5')
          this.setTooltip(Blockly.Msg['U_FUNC_CALL_TOOLTIP'] || '呼叫函式')
        },
      }
    }

    // u_return
    if (!Blockly.Blocks['u_return']) {
      Blockly.Blocks['u_return'] = {
        init: function (this: Blockly.Block) {
          this.appendValueInput('VALUE')
            .appendField(Blockly.Msg['U_RETURN_MSG'] || '回傳')
          this.setPreviousStatement(true, 'Statement')
          this.setColour('#995BA5')
          this.setTooltip(Blockly.Msg['U_RETURN_TOOLTIP'] || '回傳值')
        },
      }
    }

    // u_array_declare
    if (!Blockly.Blocks['u_array_declare']) {
      Blockly.Blocks['u_array_declare'] = {
        init: function (this: Blockly.Block) {
          this.appendDummyInput()
            .appendField(Blockly.Msg['U_ARRAY_DECLARE_MSG'] || '陣列')
            .appendField(new Blockly.FieldDropdown([
              ['int', 'int'], ['float', 'float'], ['double', 'double'],
              ['char', 'char'], ['bool', 'bool'],
            ]) as Blockly.Field, 'TYPE')
            .appendField(new Blockly.FieldTextInput('arr') as Blockly.Field, 'NAME')
            .appendField('[')
            .appendField(new Blockly.FieldNumber(10, 1) as Blockly.Field, 'SIZE')
            .appendField(']')
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setColour('#FF8C1A')
          this.setTooltip(Blockly.Msg['U_ARRAY_DECLARE_TOOLTIP'] || '宣告陣列')
        },
      }
    }

    // u_array_access
    if (!Blockly.Blocks['u_array_access']) {
      Blockly.Blocks['u_array_access'] = {
        init: function (this: Blockly.Block) {
          this.appendValueInput('INDEX')
            .appendField(new Blockly.FieldTextInput('arr') as Blockly.Field, 'NAME')
            .appendField('[')
          this.appendDummyInput()
            .appendField(']')
          this.setInputsInline(true)
          this.setOutput(true, 'Expression')
          this.setColour('#FF8C1A')
          this.setTooltip(Blockly.Msg['U_ARRAY_ACCESS_TOOLTIP'] || '陣列存取')
        },
      }
    }
  }

  private buildToolbox(): object {
    return {
      kind: 'categoryToolbox',
      contents: [
        {
          kind: 'category',
          name: Blockly.Msg['CATEGORY_DATA'] || '資料',
          colour: '#FF8C1A',
          contents: [
            { kind: 'block', type: 'u_var_declare' },
            { kind: 'block', type: 'u_var_assign' },
            { kind: 'block', type: 'u_var_ref' },
            { kind: 'block', type: 'u_number' },
            { kind: 'block', type: 'u_string' },
            { kind: 'block', type: 'u_array_declare' },
            { kind: 'block', type: 'u_array_access' },
          ],
        },
        {
          kind: 'category',
          name: Blockly.Msg['CATEGORY_OPERATORS'] || '運算',
          colour: '#59C059',
          contents: [
            { kind: 'block', type: 'u_arithmetic' },
            { kind: 'block', type: 'u_compare' },
            { kind: 'block', type: 'u_logic' },
            { kind: 'block', type: 'u_logic_not' },
            { kind: 'block', type: 'u_negate' },
          ],
        },
        {
          kind: 'category',
          name: Blockly.Msg['CATEGORY_CONTROL'] || '控制',
          colour: '#5B80A5',
          contents: [
            { kind: 'block', type: 'u_if' },
            { kind: 'block', type: 'u_if_else' },
            { kind: 'block', type: 'u_while_loop' },
            { kind: 'block', type: 'u_count_loop' },
            { kind: 'block', type: 'u_break' },
            { kind: 'block', type: 'u_continue' },
          ],
        },
        {
          kind: 'category',
          name: Blockly.Msg['CATEGORY_FUNCTIONS'] || '函式',
          colour: '#995BA5',
          contents: [
            { kind: 'block', type: 'u_func_def' },
            { kind: 'block', type: 'u_func_call' },
            { kind: 'block', type: 'u_return' },
          ],
        },
        {
          kind: 'category',
          name: Blockly.Msg['CATEGORY_IO'] || '輸入/輸出',
          colour: '#5CA65C',
          contents: [
            { kind: 'block', type: 'u_print' },
            { kind: 'block', type: 'u_input' },
            { kind: 'block', type: 'u_endl' },
          ],
        },
      ],
    }
  }

  private setupToolbar(): void {
    document.getElementById('sync-blocks-btn')?.addEventListener('click', () => {
      this.syncController?.syncBlocksToCode()
    })
    document.getElementById('undo-btn')?.addEventListener('click', () => {
      this.blocklyPanel?.undo()
    })
    document.getElementById('redo-btn')?.addEventListener('click', () => {
      this.blocklyPanel?.redo()
    })
    document.getElementById('clear-btn')?.addEventListener('click', () => {
      this.blocklyPanel?.clear()
    })
  }

  private autoSave(): void {
    try {
      const state = {
        blocklyState: this.blocklyPanel?.getState() ?? {},
        code: this.monacoPanel?.getCode() ?? '',
        lastModified: new Date().toISOString(),
      }
      localStorage.setItem('code-blockly-state', JSON.stringify(state))
    } catch { /* ignore */ }
  }

  private restoreState(): void {
    try {
      const json = localStorage.getItem('code-blockly-state')
      if (!json) return
      const state = JSON.parse(json)
      if (state.blocklyState && Object.keys(state.blocklyState).length > 0) {
        this.blocklyPanel?.setState(state.blocklyState)
      }
      if (state.code) {
        this.monacoPanel?.setCode(state.code)
      }
    } catch { /* ignore */ }
  }

  dispose(): void {
    this.blocklyPanel?.dispose()
    this.monacoPanel?.dispose()
  }
}
