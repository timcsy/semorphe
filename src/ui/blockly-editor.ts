import * as Blockly from 'blockly'
import type { BlockRegistry, ToolboxDefinition } from '../core/block-registry'
import type { ToolboxLevel, WorkspaceDiagnostic } from '../core/types'
import type { TypeEntry } from '../languages/types'
import { runDiagnosticsOnState } from '../core/diagnostics'

/** Module-level type list, updated by setLanguageTypes() */
let currentTypeEntries: TypeEntry[] = []

/** Get the current type dropdown options from the active language module */
function getLanguageTypeOptions(): Array<[string, string]> {
  if (currentTypeEntries.length === 0) {
    // Fallback: basic C++ types (before LanguageModule is loaded)
    return [
      [Blockly.Msg['TYPE_INT'] || 'int', 'int'],
      [Blockly.Msg['TYPE_FLOAT'] || 'float', 'float'],
      [Blockly.Msg['TYPE_DOUBLE'] || 'double', 'double'],
      [Blockly.Msg['TYPE_CHAR'] || 'char', 'char'],
      [Blockly.Msg['TYPE_BOOL'] || 'bool', 'bool'],
      [Blockly.Msg['TYPE_STRING'] || 'string', 'string'],
      [Blockly.Msg['TYPE_VOID'] || 'void', 'void'],
    ]
  }
  return currentTypeEntries.map(t => [
    Blockly.Msg[t.labelKey] || t.value,
    t.value,
  ] as [string, string])
}

/** Get return type options (includes void first) */
function getReturnTypeOptions(): Array<[string, string]> {
  const all = getLanguageTypeOptions()
  // Move void to the front if present
  const voidIdx = all.findIndex(([, v]) => v === 'void')
  if (voidIdx > 0) {
    const [voidEntry] = all.splice(voidIdx, 1)
    all.unshift(voidEntry)
  }
  return all
}

/** Get param type options (excludes void) */
function getParamTypeOptions(): Array<[string, string]> {
  return getLanguageTypeOptions().filter(([, v]) => v !== 'void')
}

export class BlocklyEditor {
  private workspace: Blockly.WorkspaceSvg | null = null
  private container: HTMLElement
  private onChangeCallback: ((workspace: unknown) => void) | null = null
  private onBlockSelectCallback: ((blockId: string | null) => void) | null = null

  constructor(container: HTMLElement) {
    this.container = container
  }

  init(registry: BlockRegistry, languageId?: string, level?: ToolboxLevel): void {
    // Register custom dynamic blocks first (before JSON blocks)
    this.registerCustomBlocks()

    // Register all blocks with Blockly
    this.registerBlocks(registry)

    // Create workspace with toolbox (filtered by language and level)
    const toolboxDef = registry.toToolboxDef(languageId, level)
    this.workspace = Blockly.inject(this.container, {
      toolbox: this.convertToolbox(toolboxDef) as Blockly.utils.toolbox.ToolboxDefinition,
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
    // Force re-render all blocks to fix child blocks in dynamic block inputs
    for (const block of this.workspace.getAllBlocks(false)) {
      (block as any).rendered && block.render()
    }
  }

  clear(): void {
    if (!this.workspace) return
    this.workspace.clear()
  }

  private blockCreateOffset = 0

  createBlockAtCenter(blockType: string): void {
    if (!this.workspace) return
    const metrics = this.workspace.getMetricsManager().getViewMetrics()
    const scale = this.workspace.scale
    const x = (metrics.left + metrics.width / 2) / scale + this.blockCreateOffset
    const y = (metrics.top + metrics.height / 2) / scale + this.blockCreateOffset
    Blockly.serialization.blocks.append(
      { type: blockType, x, y } as Blockly.serialization.blocks.State,
      this.workspace,
    )
    this.blockCreateOffset = (this.blockCreateOffset + 30) % 150
  }

  /** Update the available types from a language module */
  setLanguageTypes(types: TypeEntry[]): void {
    currentTypeEntries = types
  }

  updateToolbox(registry: BlockRegistry, languageId?: string, level?: ToolboxLevel): void {
    if (!this.workspace) return
    this.registerBlocks(registry)
    const toolboxDef = registry.toToolboxDef(languageId, level)
    this.workspace.updateToolbox(this.convertToolbox(toolboxDef) as Blockly.utils.toolbox.ToolboxDefinition)
  }

  runDiagnostics(): WorkspaceDiagnostic[] {
    if (!this.workspace) return []
    const state = Blockly.serialization.workspaces.save(this.workspace)
    return runDiagnosticsOnState(state)
  }

  applyDiagnostics(diagnostics: WorkspaceDiagnostic[]): void {
    if (!this.workspace) return
    // Clear all warnings first
    for (const block of this.workspace.getAllBlocks(false)) {
      block.setWarningText(null)
    }
    // Apply new warnings
    for (const diag of diagnostics) {
      const block = this.workspace.getBlockById(diag.blockId)
      if (block) {
        block.setWarningText(diag.message)
      }
    }
  }

  undo(): void {
    if (!this.workspace) return
    this.workspace.undo(false)
  }

  redo(): void {
    if (!this.workspace) return
    this.workspace.undo(true)
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
        this.setPreviousStatement(true, 'Statement')
        this.setNextStatement(true, 'Statement')
        this.setTooltip(Blockly.Msg['U_PRINT_TOOLTIP'] || '輸出一個或多個值到螢幕上')
        this.setInputsInline(true)

        this.appendDummyInput('LABEL')
          .appendField(Blockly.Msg['U_PRINT_LABEL'] || '輸出')
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
      // Type options now come from LanguageModule via getParamTypeOptions()/getReturnTypeOptions()
      /* eslint-disable @typescript-eslint/no-explicit-any */
      Blockly.Blocks['u_func_def'] = {
        paramCount_: 0,

        init: function (this: any) {
          this.paramCount_ = 0
          this.setColour(60)
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setTooltip(Blockly.Msg['U_FUNC_DEF_TOOLTIP'] || '定義一個函式（可重複使用的程式片段）。選擇 void（無回傳）表示不需要回傳結果')

          this.appendDummyInput('HEADER')
            .appendField(Blockly.Msg['U_FUNC_DEF_LABEL'] || '定義函式')
            .appendField(new Blockly.FieldTextInput('myFunc'), 'NAME')
            .appendField(Blockly.Msg['U_FUNC_DEF_RETURN_LABEL'] || '回傳')
            .appendField(new Blockly.FieldDropdown(getReturnTypeOptions), 'RETURN_TYPE')
          this.appendDummyInput('PARAMS_LABEL')
            .appendField(Blockly.Msg['U_FUNC_DEF_PARAMS_LABEL'] || '參數')
            .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plus_()))
            .appendField(new Blockly.FieldImage(MINUS_DISABLED_IMG, 20, 20, '-', () => this.minus_()), 'MINUS_BTN')
          this.appendStatementInput('BODY').setCheck('Statement')
        },

        plus_: function (this: any) {
          const idx = this.paramCount_
          this.appendDummyInput('PARAM_ROW_' + idx)
            .appendField(new Blockly.FieldDropdown(getParamTypeOptions), 'TYPE_' + idx)
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
          this.setTooltip(Blockly.Msg['U_FUNC_CALL_TOOLTIP'] || '執行指定的函式，可以傳入參數')
          this.setInputsInline(true)

          this.appendDummyInput('LABEL')
            .appendField(Blockly.Msg['U_FUNC_CALL_LABEL'] || '呼叫函式')
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
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setTooltip(Blockly.Msg['U_INPUT_TOOLTIP'] || '從鍵盤讀取一個或多個值到變數中')
          this.setInputsInline(true)

          this.appendDummyInput('LABEL')
            .appendField(Blockly.Msg['U_INPUT_LABEL'] || '讀取輸入 → 變數')
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

    // u_var_ref: dynamic dropdown listing declared variables
    if (!Blockly.Blocks['u_var_ref']) {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      Blockly.Blocks['u_var_ref'] = {
        customName_: '',

        init: function (this: any) {
          this.customName_ = ''
          this.setColour(330)
          this.setOutput(true, 'Expression')
          this.setTooltip(Blockly.Msg['U_VAR_REF_TOOLTIP'] || '使用這個變數目前存放的值')

          this.appendDummyInput('MAIN')
            .appendField(new Blockly.FieldDropdown(
              this.generateOptions_.bind(this),
              this.onDropdownChange_.bind(this),
            ), 'NAME')
          // Hidden custom input, shown only when __CUSTOM__ is selected
          this.appendDummyInput('CUSTOM_INPUT')
            .appendField(new Blockly.FieldTextInput('x'), 'CUSTOM_NAME')
          this.getInput('CUSTOM_INPUT')!.setVisible(false)
        },

        generateOptions_: function (this: any): Array<[string, string]> {
          const ws = this.workspace
          if (!ws) return [[Blockly.Msg['U_VAR_REF_CUSTOM'] || '(自訂)', '__CUSTOM__']]

          const options: Array<[string, string]> = []
          const seen = new Set<string>()

          // Collect from u_var_declare
          const declareBlocks = ws.getBlocksByType('u_var_declare', false)
          for (const b of declareBlocks) {
            const name = b.getFieldValue('NAME')
            if (name && !seen.has(name)) {
              seen.add(name)
              options.push([name, name])
            }
          }

          // Collect from u_count_loop VAR
          const loopBlocks = ws.getBlocksByType('u_count_loop', false)
          for (const b of loopBlocks) {
            const name = b.getFieldValue('VAR')
            if (name && !seen.has(name)) {
              seen.add(name)
              options.push([name, name])
            }
          }

          // Always add custom option at the end
          options.push([Blockly.Msg['U_VAR_REF_CUSTOM'] || '(自訂)', '__CUSTOM__'])
          return options
        },

        onDropdownChange_: function (this: any, newValue: string) {
          const block = this.getSourceBlock ? this.getSourceBlock() : this
          if (!block) return newValue
          const customInput = block.getInput('CUSTOM_INPUT')
          if (customInput) {
            customInput.setVisible(newValue === '__CUSTOM__')
            block.customName_ = newValue === '__CUSTOM__' ? (block.getFieldValue('CUSTOM_NAME') || 'x') : ''
          }
          block.render()
          return newValue
        },

        saveExtraState: function (this: any) {
          return { customName: this.customName_ }
        },

        loadExtraState: function (this: any, state: any) {
          this.customName_ = state?.customName ?? ''
          if (this.customName_) {
            this.setFieldValue('__CUSTOM__', 'NAME')
            this.setFieldValue(this.customName_, 'CUSTOM_NAME')
            const customInput = this.getInput('CUSTOM_INPUT')
            if (customInput) customInput.setVisible(true)
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
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setTooltip(Blockly.Msg['U_VAR_DECLARE_TOOLTIP'] || '建立一個新的變數，可以選擇型別和初始值。變數就像一個有名字的盒子，用來存放資料')

          this.appendDummyInput('DECL')
            .appendField(new Blockly.FieldDropdown(function() {
              return getLanguageTypeOptions().filter(([, v]) => v !== 'void')
            }), 'TYPE')
            .appendField(new Blockly.FieldTextInput('x'), 'NAME')
            .appendField(new Blockly.FieldDropdown(
              function() { return [
                [Blockly.Msg['U_VAR_DECLARE_WITH_INIT'] || '有初始值', 'with_init'],
                [Blockly.Msg['U_VAR_DECLARE_NO_INIT'] || '無初始值', 'no_init'],
              ] },
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
          this.setInputsInline(true)
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

  private static readonly CATEGORY_I18N_KEYS: Record<string, string> = {
    data: 'CAT_DATA',
    operators: 'CAT_OPERATORS',
    control: 'CAT_CONTROL',
    functions: 'CAT_FUNCTIONS',
    io: 'CAT_IO',
    arrays: 'CAT_ARRAYS',
    variables: 'CAT_VARIABLES',
    values: 'CAT_VALUES',
    conditions: 'CAT_CONDITIONS',
    loops: 'CAT_LOOPS',
    pointers: 'CAT_POINTERS',
    structures: 'CAT_STRUCTURES',
    strings: 'CAT_STRINGS',
    containers: 'CAT_CONTAINERS',
    algorithms: 'CAT_ALGORITHMS',
    oop: 'CAT_OOP',
    templates: 'CAT_TEMPLATES',
    special: 'CAT_SPECIAL',
    preprocessor: 'CAT_PREPROCESSOR',
  }

  private convertToolbox(def: ToolboxDefinition): object {
    return {
      kind: 'categoryToolbox',
      contents: def.contents.map(cat => ({
        kind: 'category',
        name: (BlocklyEditor.CATEGORY_I18N_KEYS[cat.name] ? Blockly.Msg[BlocklyEditor.CATEGORY_I18N_KEYS[cat.name]] : null) ?? cat.name,
        contents: cat.contents.map(block => ({
          kind: 'block',
          type: block.type,
        })),
      })),
    }
  }
}
