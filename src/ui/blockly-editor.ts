import * as Blockly from 'blockly'
import type { BlockRegistry, ToolboxDefinition } from '../core/block-registry'

export class BlocklyEditor {
  private workspace: Blockly.WorkspaceSvg | null = null
  private container: HTMLElement
  private onChangeCallback: ((workspace: unknown) => void) | null = null
  private onBlockSelectCallback: ((blockId: string | null) => void) | null = null

  constructor(container: HTMLElement) {
    this.container = container
  }

  init(registry: BlockRegistry, languageId?: string): void {
    // Register custom dynamic blocks first (before JSON blocks)
    this.registerCustomBlocks()

    // Register all blocks with Blockly
    this.registerBlocks(registry)

    // Create workspace with toolbox (filtered by language)
    const toolboxDef = registry.toToolboxDef(languageId)
    this.workspace = Blockly.inject(this.container, {
      toolbox: this.convertToolbox(toolboxDef),
      grid: { spacing: 20, length: 3, colour: '#ccc', snap: true },
      zoom: { controls: true, wheel: true, startScale: 1.0, maxScale: 3, minScale: 0.3, scaleSpeed: 1.2 },
      trashcan: true,
    })

    // Listen for changes
    this.workspace.addChangeListener((event: Blockly.Events.Abstract) => {
      // Handle block selection events for bidirectional highlight
      if (event.type === Blockly.Events.SELECTED) {
        const selectedEvent = event as Blockly.Events.Selected
        this.onBlockSelectCallback?.(selectedEvent.newElementId ?? null)
        return
      }

      if (event.isUiEvent) return
      if (this.onChangeCallback) {
        const state = Blockly.serialization.workspaces.save(this.workspace!)
        this.onChangeCallback(state)
      }
    })
  }

  onChange(callback: (workspace: unknown) => void): void {
    this.onChangeCallback = callback
  }

  onBlockSelect(callback: (blockId: string | null) => void): void {
    this.onBlockSelectCallback = callback
  }

  highlightBlock(blockId: string | null): void {
    if (!this.workspace) return
    this.workspace.highlightBlock(blockId ?? '')
  }

  getState(): unknown {
    if (!this.workspace) return { blocks: { languageVersion: 0, blocks: [] } }
    return Blockly.serialization.workspaces.save(this.workspace)
  }

  setState(state: unknown): void {
    if (!this.workspace) return
    Blockly.serialization.workspaces.load(state as object, this.workspace)
  }

  updateToolbox(registry: BlockRegistry, languageId?: string): void {
    if (!this.workspace) return
    this.registerBlocks(registry)
    const toolboxDef = registry.toToolboxDef(languageId)
    this.workspace.updateToolbox(this.convertToolbox(toolboxDef) as Blockly.utils.toolbox.ToolboxDefinition)
  }

  dispose(): void {
    if (this.workspace) {
      this.workspace.dispose()
      this.workspace = null
    }
  }

  private registerCustomBlocks(): void {
    // u_print: dynamic expression inputs with +/- buttons
    if (Blockly.Blocks['u_print']) return

    // Circular +/- icons (20x20) with disabled state
    const PLUS_IMG = 'data:image/svg+xml,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20">' +
      '<circle cx="10" cy="10" r="9" fill="#4A90D9"/>' +
      '<path d="M6 10h8M10 6v8" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>'
    )
    const MINUS_IMG = 'data:image/svg+xml,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20">' +
      '<circle cx="10" cy="10" r="9" fill="#9E9E9E"/>' +
      '<path d="M6 10h8" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>'
    )
    const MINUS_DISABLED_IMG = 'data:image/svg+xml,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20">' +
      '<circle cx="10" cy="10" r="9" fill="#E0E0E0"/>' +
      '<path d="M6 10h8" stroke="#BDBDBD" stroke-width="2" stroke-linecap="round"/></svg>'
    )

    /** Update the minus button image based on current count vs minimum */
    const setMinusState = (block: any, isAtMin: boolean) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const f = block.getField('MINUS_BTN')
      if (f) f.setValue(isAtMin ? MINUS_DISABLED_IMG : MINUS_IMG)
    }

    /* eslint-disable @typescript-eslint/no-explicit-any */
    Blockly.Blocks['u_print'] = {
      itemCount_: 1,

      init: function (this: any) {
        this.itemCount_ = 1
        this.setColour(180)
        this.setPreviousStatement(true, null)
        this.setNextStatement(true, null)
        this.setTooltip('輸出一個或多個值到螢幕上')
        this.setInputsInline(true)

        this.appendDummyInput('LABEL')
          .appendField('輸出')
        this.appendValueInput('EXPR0')
          .setCheck('Expression')
        this.appendDummyInput('TAIL')
          .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plus_()))
          .appendField(new Blockly.FieldImage(MINUS_DISABLED_IMG, 20, 20, '-', () => this.minus_()), 'MINUS_BTN')
      },

      plus_: function (this: any) {
        this.appendValueInput('EXPR' + this.itemCount_)
          .setCheck('Expression')
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

      loadExtraState: function (this: any, state: any) {
        const count = state?.itemCount ?? 1
        while (this.itemCount_ < count) {
          this.plus_()
        }
      },

      mutationToDom: function (this: any) {
        const mutation = Blockly.utils.xml.createElement('mutation')
        mutation.setAttribute('items', String(this.itemCount_))
        return mutation
      },

      domToMutation: function (this: any, xml: Element) {
        const count = parseInt(xml.getAttribute('items') || '1', 10)
        while (this.itemCount_ < count) {
          this.plus_()
        }
      },
    }
    /* eslint-enable @typescript-eslint/no-explicit-any */

    // u_func_def: dynamic parameter rows with +/- buttons
    if (!Blockly.Blocks['u_func_def']) {
      const TYPE_OPTIONS = [['int','int'],['float','float'],['double','double'],['char','char'],['bool','bool'],['string','string'],['void','void']]
      /* eslint-disable @typescript-eslint/no-explicit-any */
      Blockly.Blocks['u_func_def'] = {
        paramCount_: 0,

        init: function (this: any) {
          this.paramCount_ = 0
          this.setColour(60)
          this.setPreviousStatement(true, null)
          this.setNextStatement(true, null)
          this.setTooltip('定義一個函式')

          this.appendDummyInput('HEADER')
            .appendField('定義函式')
            .appendField(new Blockly.FieldTextInput('myFunc'), 'NAME')
            .appendField('回傳')
            .appendField(new Blockly.FieldDropdown([['void','void'],['int','int'],['float','float'],['double','double'],['char','char'],['long long','long long'],['string','string'],['bool','bool']]), 'RETURN_TYPE')
          this.appendDummyInput('PARAMS_LABEL')
            .appendField('參數')
            .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plus_()))
            .appendField(new Blockly.FieldImage(MINUS_DISABLED_IMG, 20, 20, '-', () => this.minus_()), 'MINUS_BTN')
          this.appendStatementInput('BODY')
        },

        plus_: function (this: any) {
          const idx = this.paramCount_
          this.appendDummyInput('PARAM_ROW_' + idx)
            .appendField(new Blockly.FieldDropdown(TYPE_OPTIONS), 'TYPE_' + idx)
            .appendField(new Blockly.FieldTextInput('p' + idx), 'PARAM_' + idx)
          this.moveInputBefore('PARAM_ROW_' + idx, 'BODY')
          this.paramCount_++
          setMinusState(this, false)
        },

        minus_: function (this: any) {
          if (this.paramCount_ <= 0) return
          this.paramCount_--
          this.removeInput('PARAM_ROW_' + this.paramCount_)
          setMinusState(this, this.paramCount_ <= 0)
        },

        saveExtraState: function (this: any) {
          return { paramCount: this.paramCount_ }
        },

        loadExtraState: function (this: any, state: any) {
          const count = state?.paramCount ?? 0
          while (this.paramCount_ < count) {
            this.plus_()
          }
        },

        mutationToDom: function (this: any) {
          const mutation = Blockly.utils.xml.createElement('mutation')
          mutation.setAttribute('params', String(this.paramCount_))
          return mutation
        },

        domToMutation: function (this: any, xml: Element) {
          const count = parseInt(xml.getAttribute('params') || '0', 10)
          while (this.paramCount_ < count) {
            this.plus_()
          }
        },
      }
      /* eslint-enable @typescript-eslint/no-explicit-any */
    }

    // u_func_call: dynamic argument inputs with +/- buttons
    if (!Blockly.Blocks['u_func_call']) {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      Blockly.Blocks['u_func_call'] = {
        argCount_: 0,

        init: function (this: any) {
          this.argCount_ = 0
          this.setColour(60)
          this.setOutput(true, 'Expression')
          this.setTooltip('呼叫一個函式')
          this.setInputsInline(true)

          this.appendDummyInput('LABEL')
            .appendField('呼叫')
            .appendField(new Blockly.FieldTextInput('func'), 'NAME')
            .appendField('(')
          this.appendDummyInput('TAIL')
            .appendField(')')
            .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plus_()))
            .appendField(new Blockly.FieldImage(MINUS_DISABLED_IMG, 20, 20, '-', () => this.minus_()), 'MINUS_BTN')
        },

        plus_: function (this: any) {
          this.appendValueInput('ARG' + this.argCount_)
            .setCheck('Expression')
          this.moveInputBefore('ARG' + this.argCount_, 'TAIL')
          this.argCount_++
          setMinusState(this, false)
        },

        minus_: function (this: any) {
          if (this.argCount_ <= 0) return
          this.argCount_--
          this.removeInput('ARG' + this.argCount_)
          setMinusState(this, this.argCount_ <= 0)
        },

        saveExtraState: function (this: any) {
          return { argCount: this.argCount_ }
        },

        loadExtraState: function (this: any, state: any) {
          const count = state?.argCount ?? 0
          while (this.argCount_ < count) {
            this.plus_()
          }
        },

        mutationToDom: function (this: any) {
          const mutation = Blockly.utils.xml.createElement('mutation')
          mutation.setAttribute('args', String(this.argCount_))
          return mutation
        },

        domToMutation: function (this: any, xml: Element) {
          const count = parseInt(xml.getAttribute('args') || '0', 10)
          while (this.argCount_ < count) {
            this.plus_()
          }
        },
      }
      /* eslint-enable @typescript-eslint/no-explicit-any */
    }

    // u_input: dynamic variable name fields with +/- buttons
    if (!Blockly.Blocks['u_input']) {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      Blockly.Blocks['u_input'] = {
        varCount_: 1,

        init: function (this: any) {
          this.varCount_ = 1
          this.setColour(180)
          this.setPreviousStatement(true, null)
          this.setNextStatement(true, null)
          this.setTooltip('從鍵盤讀取一個或多個變數')
          this.setInputsInline(true)

          this.appendDummyInput('LABEL')
            .appendField('輸入')
          this.appendDummyInput('VAR_0')
            .appendField(new Blockly.FieldTextInput('x'), 'NAME_0')
          this.appendDummyInput('TAIL')
            .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plus_()))
            .appendField(new Blockly.FieldImage(MINUS_DISABLED_IMG, 20, 20, '-', () => this.minus_()), 'MINUS_BTN')
        },

        plus_: function (this: any) {
          this.appendDummyInput('VAR_' + this.varCount_)
            .appendField(new Blockly.FieldTextInput('v' + this.varCount_), 'NAME_' + this.varCount_)
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
          return { varCount: this.varCount_ }
        },

        loadExtraState: function (this: any, state: any) {
          const count = state?.varCount ?? 1
          while (this.varCount_ < count) {
            this.plus_()
          }
        },

        mutationToDom: function (this: any) {
          const mutation = Blockly.utils.xml.createElement('mutation')
          mutation.setAttribute('vars', String(this.varCount_))
          return mutation
        },

        domToMutation: function (this: any, xml: Element) {
          const count = parseInt(xml.getAttribute('vars') || '1', 10)
          while (this.varCount_ < count) {
            this.plus_()
          }
        },
      }
      /* eslint-enable @typescript-eslint/no-explicit-any */
    }

    // u_var_declare: dropdown to switch between init/no-init modes
    if (!Blockly.Blocks['u_var_declare']) {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      Blockly.Blocks['u_var_declare'] = {
        initMode_: 'with_init',

        init: function (this: any) {
          this.initMode_ = 'with_init'
          this.setColour(330)
          this.setPreviousStatement(true, null)
          this.setNextStatement(true, null)
          this.setTooltip('宣告一個變數')

          this.appendDummyInput('DECL')
            .appendField(new Blockly.FieldDropdown(
              [['int','int'],['float','float'],['double','double'],['char','char'],['bool','bool'],['string','string'],['long long','long long']],
            ), 'TYPE')
            .appendField(new Blockly.FieldTextInput('x'), 'NAME')
            .appendField(new Blockly.FieldDropdown(
              [['有初始值','with_init'],['無初始值','no_init']],
              function (this: Blockly.FieldDropdown, newValue: string) {
                const block = this.getSourceBlock() as any
                if (block) block.updateShape_(newValue)
                return newValue
              }
            ), 'INIT_MODE')
          // Default: show init input
          this.appendValueInput('INIT')
            .setCheck('Expression')
            .appendField('=')
        },

        updateShape_: function (this: any, mode: string) {
          this.initMode_ = mode
          if (mode === 'no_init') {
            if (this.getInput('INIT')) {
              this.removeInput('INIT')
            }
          } else {
            if (!this.getInput('INIT')) {
              this.appendValueInput('INIT')
                .setCheck('Expression')
                .appendField('=')
            }
          }
        },

        saveExtraState: function (this: any) {
          return { initMode: this.initMode_ }
        },

        loadExtraState: function (this: any, state: any) {
          const mode = state?.initMode ?? 'with_init'
          if (mode !== this.initMode_) {
            this.updateShape_(mode)
            this.setFieldValue(mode, 'INIT_MODE')
          }
        },

        mutationToDom: function (this: any) {
          const mutation = Blockly.utils.xml.createElement('mutation')
          mutation.setAttribute('init_mode', this.initMode_)
          return mutation
        },

        domToMutation: function (this: any, xml: Element) {
          const mode = xml.getAttribute('init_mode') || 'with_init'
          if (mode !== this.initMode_) {
            this.updateShape_(mode)
            this.setFieldValue(mode, 'INIT_MODE')
          }
        },
      }
      /* eslint-enable @typescript-eslint/no-explicit-any */
    }
  }

  private registerBlocks(registry: BlockRegistry): void {
    // Register all block definitions with Blockly
    for (const spec of registry.getAll()) {
      if (!Blockly.Blocks[spec.id]) {
        Blockly.Blocks[spec.id] = {
          init: function (this: Blockly.Block) {
            this.jsonInit(spec.blockDef as object)
          },
        }
      }
    }
  }

  private static readonly CATEGORY_NAMES: Record<string, string> = {
    data: '資料',
    operators: '運算',
    control: '流程控制',
    functions: '函式',
    io: '輸入輸出',
    arrays: '陣列',
    variables: '變數',
    values: '數值',
    conditions: '條件',
    loops: '迴圈',
    pointers: '指標',
    structures: '結構',
    strings: '字串',
    containers: '容器',
    algorithms: '演算法',
    oop: '物件導向',
    templates: '模板',
    special: '特殊',
    preprocessor: '前處理',
  }

  private convertToolbox(def: ToolboxDefinition): object {
    return {
      kind: 'categoryToolbox',
      contents: def.contents.map(cat => ({
        kind: 'category',
        name: BlocklyEditor.CATEGORY_NAMES[cat.name] ?? cat.name,
        contents: cat.contents.map(block => ({
          kind: 'block',
          type: block.type,
        })),
      })),
    }
  }
}
