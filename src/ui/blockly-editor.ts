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
      renderer: 'zelos',
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
        this.setColour('#5CB1D6')
        this.setPreviousStatement(true, 'Statement')
        this.setNextStatement(true, 'Statement')
        this.setTooltip(Blockly.Msg['U_PRINT_TOOLTIP'] || '輸出一個或多個值到螢幕上')
        this.setInputsInline(true)

        this.appendValueInput('EXPR0')
          .setCheck('Expression')
          .appendField(Blockly.Msg['U_PRINT_LABEL'] || '輸出')
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
          this.setColour('#FF6680')
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
          this.setColour('#FF6680')
          this.setOutput(true, 'Expression')
          this.setTooltip(Blockly.Msg['U_FUNC_CALL_TOOLTIP'] || '執行指定的函式，可以傳入參數')
          this.setInputsInline(true)

          // 0 args: all DummyInput (no alignment issue)
          this.appendDummyInput('LABEL')
            .appendField(Blockly.Msg['U_FUNC_CALL_LABEL'] || '呼叫函式')
            .appendField(new Blockly.FieldTextInput('func'), 'NAME')
            .appendField('()')
          this.appendDummyInput('TAIL')
            .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plus_()))
            .appendField(new Blockly.FieldImage(MINUS_DISABLED_IMG, 20, 20, '-', () => this.minus_()), 'MINUS_BTN')
        },

        plus_: function (this: any) {
          this.argCount_++
          this.updateShape_()
        },

        minus_: function (this: any) {
          if (this.argCount_ <= 0) return
          this.argCount_--
          this.updateShape_()
        },

        /** Rebuild inputs: label on first ValueInput when args > 0 for alignment */
        updateShape_: function (this: any) {
          // Save connections and name
          const savedConns: any[] = []
          for (let i = 0; ; i++) {
            const inp = this.getInput('ARG' + i)
            if (!inp) break
            savedConns.push(inp.connection?.targetConnection || null)
          }
          const savedName = this.getFieldValue('NAME')

          // Remove all dynamic inputs
          if (this.getInput('LABEL')) this.removeInput('LABEL')
          for (let i = 0; ; i++) {
            if (!this.getInput('ARG' + i)) break
            this.removeInput('ARG' + i)
          }
          if (this.getInput('TAIL')) this.removeInput('TAIL')

          const label = Blockly.Msg['U_FUNC_CALL_LABEL'] || '呼叫函式'
          const name = savedName || 'func'

          if (this.argCount_ === 0) {
            this.appendDummyInput('LABEL')
              .appendField(label)
              .appendField(new Blockly.FieldTextInput(name), 'NAME')
              .appendField('()')
          } else {
            // Label on first ValueInput for horizontal alignment
            this.appendValueInput('ARG0')
              .setCheck('Expression')
              .appendField(label)
              .appendField(new Blockly.FieldTextInput(name), 'NAME')
              .appendField('(')
            for (let i = 1; i < this.argCount_; i++) {
              this.appendValueInput('ARG' + i)
                .setCheck('Expression')
                .appendField(',')
            }
          }

          this.appendDummyInput('TAIL')
            .appendField(this.argCount_ > 0 ? ')' : '')
            .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plus_()))
            .appendField(new Blockly.FieldImage(MINUS_DISABLED_IMG, 20, 20, '-', () => this.minus_()), 'MINUS_BTN')

          setMinusState(this, this.argCount_ <= 0)

          // Reconnect saved connections
          for (let i = 0; i < savedConns.length && i < this.argCount_; i++) {
            if (savedConns[i]) {
              savedConns[i].reconnect(this, 'ARG' + i)
            }
          }
        },

        saveExtraState: function (this: any) {
          return { argCount: this.argCount_ }
        },

        loadExtraState: function (this: any, state: any) {
          this.argCount_ = state?.argCount ?? 0
          this.updateShape_()
        },

        mutationToDom: function (this: any) {
          const mutation = Blockly.utils.xml.createElement('mutation')
          mutation.setAttribute('args', String(this.argCount_))
          return mutation
        },

        domToMutation: function (this: any, xml: Element) {
          this.argCount_ = parseInt(xml.getAttribute('args') || '0', 10)
          this.updateShape_()
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
          this.setColour('#5CB1D6')
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

    // Mutator helper blocks for u_if_else (used in gear/mutator mini-workspace)
    if (!Blockly.Blocks['u_if_else_if_container']) {
      Blockly.Blocks['u_if_else_if_container'] = {
        init: function (this: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
          this.setColour('#FFAB19')
          this.appendDummyInput().appendField(Blockly.Msg['U_IF_ELSE_IF_LABEL'] || '如果')
          this.setNextStatement(true)
          this.contextMenu = false
        },
      }
    }
    if (!Blockly.Blocks['u_if_else_elseif_input']) {
      Blockly.Blocks['u_if_else_elseif_input'] = {
        init: function (this: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
          this.setColour('#FFAB19')
          this.appendDummyInput().appendField(Blockly.Msg['U_IF_ELSE_ELSEIF_MSG'] || '否則，如果')
          this.setPreviousStatement(true)
          this.setNextStatement(true)
          this.contextMenu = false
        },
      }
    }
    if (!Blockly.Blocks['u_if_else_else_input']) {
      Blockly.Blocks['u_if_else_else_input'] = {
        init: function (this: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
          this.setColour('#FFAB19')
          this.appendDummyInput().appendField(Blockly.Msg['U_IF_ELSE_MSG2'] || '否則')
          this.setPreviousStatement(true)
          this.contextMenu = false
        },
      }
    }

    // u_if_else: +/- for else-if, gear (mutator) for arrangement
    if (!Blockly.Blocks['u_if_else']) {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      Blockly.Blocks['u_if_else'] = {
        elseIfCount_: 0,
        hasElse_: false,

        init: function (this: any) {
          this.elseIfCount_ = 0
          this.hasElse_ = false
          this.setColour('#FFAB19')
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setTooltip(Blockly.Msg['U_IF_ELSE_TOOLTIP'] || '如果條件成立就執行「就」的部分，否則執行「否則」的部分')

          this.appendValueInput('COND')
            .appendField(Blockly.Msg['U_IF_ELSE_IF_LABEL'] || '如果')
            .setCheck('Expression')
          this.appendStatementInput('THEN').setCheck('Statement')
          // TAIL: +/- for else-if
          this.appendDummyInput('TAIL')
            .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plus_()))
            .appendField(new Blockly.FieldImage(MINUS_DISABLED_IMG, 20, 20, '-', () => this.minus_()), 'MINUS_BTN')
          // Mutator gear icon for arrangement (else-if + else)
          this.setMutator(new Blockly.icons.MutatorIcon(
            ['u_if_else_elseif_input', 'u_if_else_else_input'], this))
        },

        /** Rebuild TAIL row (with +/- buttons only) */
        rebuildTail_: function (this: any) {
          // Determine where TAIL should go: before ELSE if present
          const beforeInput = this.hasElse_ ? 'ELSE' : null
          this.removeInput('TAIL')
          const tail = this.appendDummyInput('TAIL')
          if (this.hasElse_) {
            tail.appendField(Blockly.Msg['U_IF_ELSE_MSG2'] || '否則')
          }
          tail.appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plus_()))
          tail.appendField(new Blockly.FieldImage(
            (this.elseIfCount_ <= 0 ? MINUS_DISABLED_IMG : MINUS_IMG), 20, 20, '-', () => this.minus_()), 'MINUS_BTN')
          if (beforeInput) {
            this.moveInputBefore('TAIL', beforeInput)
          }
        },

        /** + always adds else-if */
        plus_: function (this: any) {
          this.elseIfCount_++
          const idx = this.elseIfCount_
          this.appendValueInput('COND' + idx)
            .appendField(Blockly.Msg['U_IF_ELSE_ELSEIF_MSG'] || '否則，如果')
            .setCheck('Expression')
          this.appendStatementInput('THEN' + idx).setCheck('Statement')
          this.moveInputBefore('COND' + idx, 'TAIL')
          this.moveInputBefore('THEN' + idx, 'TAIL')
          setMinusState(this, false)
        },

        /** - always removes last else-if */
        minus_: function (this: any) {
          if (this.elseIfCount_ > 0) {
            const idx = this.elseIfCount_
            this.removeInput('THEN' + idx)
            this.removeInput('COND' + idx)
            this.elseIfCount_--
            setMinusState(this, this.elseIfCount_ <= 0)
          }
        },

        /**
         * Rebuild all inputs to match elseIfCount_ and hasElse_.
         * Used by mutator compose and loadExtraState.
         */
        updateShape_: function (this: any) {
          // Remove existing else-if inputs
          for (let i = 1; this.getInput('COND' + i); i++) {
            this.removeInput('COND' + i)
            this.removeInput('THEN' + i)
          }
          // Remove ELSE if present
          if (this.getInput('ELSE')) {
            this.removeInput('ELSE')
          }
          // Re-add else-if inputs
          for (let i = 1; i <= this.elseIfCount_; i++) {
            this.appendValueInput('COND' + i)
              .appendField(Blockly.Msg['U_IF_ELSE_ELSEIF_MSG'] || '否則，如果')
              .setCheck('Expression')
            this.appendStatementInput('THEN' + i).setCheck('Statement')
            this.moveInputBefore('COND' + i, 'TAIL')
            this.moveInputBefore('THEN' + i, 'TAIL')
          }
          // Re-add ELSE if needed
          if (this.hasElse_) {
            this.appendStatementInput('ELSE').setCheck('Statement')
          }
          // Rebuild TAIL (updates label and button states)
          this.rebuildTail_()
        },

        /** Mutator: decompose into mini-workspace blocks */
        decompose: function (this: any, workspace: any) {
          const containerBlock = workspace.newBlock('u_if_else_if_container')
          containerBlock.initSvg()
          let connection = containerBlock.nextConnection
          for (let i = 1; i <= this.elseIfCount_; i++) {
            const elseIfBlock = workspace.newBlock('u_if_else_elseif_input')
            elseIfBlock.initSvg()
            connection.connect(elseIfBlock.previousConnection)
            connection = elseIfBlock.nextConnection
          }
          if (this.hasElse_) {
            const elseBlock = workspace.newBlock('u_if_else_else_input')
            elseBlock.initSvg()
            connection.connect(elseBlock.previousConnection)
          }
          return containerBlock
        },

        /** Mutator: recompose from mini-workspace arrangement */
        compose: function (this: any, containerBlock: any) {
          // Walk the chain to count else-if and else
          let block = containerBlock.nextConnection.targetBlock()
          let newElseIfCount = 0
          let newHasElse = false
          const condConnections: any[] = [null]
          const thenConnections: any[] = [null]
          let elseConnection: any = null
          while (block) {
            if (!block.isInsertionMarker()) {
              switch (block.type) {
                case 'u_if_else_elseif_input':
                  newElseIfCount++
                  condConnections.push(block.condConnection_)
                  thenConnections.push(block.thenConnection_)
                  break
                case 'u_if_else_else_input':
                  newHasElse = true
                  elseConnection = block.elseConnection_
                  break
              }
            }
            block = block.getNextBlock()
          }
          this.elseIfCount_ = newElseIfCount
          this.hasElse_ = newHasElse
          this.updateShape_()
          // Reconnect child blocks
          this.reconnectChildBlocks_(condConnections, thenConnections, elseConnection)
        },

        /** Mutator: save connections before recompose */
        saveConnections: function (this: any, containerBlock: any) {
          let block = containerBlock.nextConnection.targetBlock()
          let i = 1
          while (block) {
            if (!block.isInsertionMarker()) {
              switch (block.type) {
                case 'u_if_else_elseif_input': {
                  const condInput = this.getInput('COND' + i)
                  const thenInput = this.getInput('THEN' + i)
                  block.condConnection_ = condInput && condInput.connection.targetConnection
                  block.thenConnection_ = thenInput && thenInput.connection.targetConnection
                  i++
                  break
                }
                case 'u_if_else_else_input': {
                  const elseInput = this.getInput('ELSE')
                  block.elseConnection_ = elseInput && elseInput.connection.targetConnection
                  break
                }
              }
            }
            block = block.getNextBlock()
          }
        },

        /** Reconnect child blocks after updateShape_ */
        reconnectChildBlocks_: function (this: any, condConns: any[], thenConns: any[], elseConn: any) {
          for (let i = 1; i <= this.elseIfCount_; i++) {
            condConns[i]?.reconnect(this, 'COND' + i)
            thenConns[i]?.reconnect(this, 'THEN' + i)
          }
          elseConn?.reconnect(this, 'ELSE')
        },

        saveExtraState: function (this: any) {
          return { hasElse: this.hasElse_, elseIfCount: this.elseIfCount_ }
        },

        loadExtraState: function (this: any, state: any) {
          // Backward compat: if hasElse not defined but old data exists, default true
          this.hasElse_ = state?.hasElse ?? (state?.elseIfCount > 0 ? true : false)
          this.elseIfCount_ = state?.elseIfCount ?? 0
          this.updateShape_()
        },

        mutationToDom: function (this: any) {
          const mutation = Blockly.utils.xml.createElement('mutation')
          mutation.setAttribute('haselse', String(this.hasElse_))
          mutation.setAttribute('elseifcount', String(this.elseIfCount_))
          return mutation
        },

        domToMutation: function (this: any, xml: Element) {
          this.hasElse_ = xml.getAttribute('haselse') === 'true'
          this.elseIfCount_ = parseInt(xml.getAttribute('elseifcount') || '0', 10)
          this.updateShape_()
        },
      }
      /* eslint-enable @typescript-eslint/no-explicit-any */
    }

    // Mutator helper blocks for u_var_declare (gear mini-workspace)
    if (!Blockly.Blocks['u_var_declare_container']) {
      Blockly.Blocks['u_var_declare_container'] = {
        init: function (this: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
          this.setColour('#FF8C1A')
          this.appendDummyInput().appendField(Blockly.Msg['U_VAR_DECLARE_HEADER'] || '宣告')
          this.setNextStatement(true)
          this.contextMenu = false
        },
      }
    }
    if (!Blockly.Blocks['u_var_declare_var_input']) {
      Blockly.Blocks['u_var_declare_var_input'] = {
        init: function (this: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
          this.setColour('#FF8C1A')
          this.appendDummyInput().appendField(Blockly.Msg['U_VAR_DECLARE_VAR_LABEL'] || '變數')
          this.setPreviousStatement(true)
          this.setNextStatement(true)
          this.contextMenu = false
        },
      }
    }
    if (!Blockly.Blocks['u_var_declare_var_init_input']) {
      Blockly.Blocks['u_var_declare_var_init_input'] = {
        init: function (this: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
          this.setColour('#FF8C1A')
          this.appendDummyInput().appendField(Blockly.Msg['U_VAR_DECLARE_VAR_INIT_LABEL'] || '變數 = 值')
          this.setPreviousStatement(true)
          this.setNextStatement(true)
          this.contextMenu = false
        },
      }
    }

    // u_var_ref: dynamic dropdown listing declared variables
    if (!Blockly.Blocks['u_var_ref']) {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      Blockly.Blocks['u_var_ref'] = {
        customName_: '',

        init: function (this: any) {
          this.customName_ = ''
          this.setColour('#FF8C1A')
          this.setOutput(true, 'Expression')
          this.setTooltip(Blockly.Msg['U_VAR_REF_TOOLTIP'] || '使用這個變數目前存放的值')

          this.appendDummyInput('MAIN')
            .appendField(new Blockly.FieldDropdown(
              this.generateOptions_.bind(this),
              this.onDropdownChange_.bind(this),
            ), 'NAME')
            .appendField(new Blockly.FieldTextInput('x'), 'CUSTOM_NAME')
          // Hide custom field at field level (not input level) for Zelos compatibility
          this.getField('CUSTOM_NAME')!.setVisible(false)
        },

        generateOptions_: function (this: any): Array<[string, string]> {
          const ws = this.workspace
          if (!ws) return [[Blockly.Msg['U_VAR_REF_CUSTOM'] || '(自訂)', '__CUSTOM__']]

          const options: Array<[string, string]> = []
          const seen = new Set<string>()

          // Collect from u_var_declare (multi-variable: NAME_0, NAME_1, ...)
          const declareBlocks = ws.getBlocksByType('u_var_declare', false)
          for (const b of declareBlocks) {
            for (let idx = 0; ; idx++) {
              const name = b.getFieldValue('NAME_' + idx)
              if (name === null || name === undefined) break
              if (name && !seen.has(name)) {
                seen.add(name)
                options.push([name, name])
              }
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
          const customField = block.getField('CUSTOM_NAME')
          if (customField) {
            customField.setVisible(newValue === '__CUSTOM__')
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
            const customField = this.getField('CUSTOM_NAME')
            if (customField) customField.setVisible(true)
          }
        },
      }
      /* eslint-enable @typescript-eslint/no-explicit-any */
    }

    // u_var_declare: multi-variable with mutator gear + per-variable init control
    if (!Blockly.Blocks['u_var_declare']) {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      Blockly.Blocks['u_var_declare'] = {
        items_: ['var_init'] as string[],

        init: function (this: any) {
          this.items_ = ['var_init']
          this.setColour('#FF8C1A')
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setTooltip(Blockly.Msg['U_VAR_DECLARE_TOOLTIP'] || '建立一個新的變數，可以選擇型別和初始值。變數就像一個有名字的盒子，用來存放資料')

          // First var_init row with HEADER fields for alignment
          this.appendValueInput('INIT_0')
            .setCheck('Expression')
            .appendField(Blockly.Msg['U_VAR_DECLARE_HEADER'] || '宣告')
            .appendField(new Blockly.FieldDropdown(function() {
              return getLanguageTypeOptions().filter(([, v]) => v !== 'void')
            }), 'TYPE')
            .appendField(new Blockly.FieldTextInput('x'), 'NAME_0')
            .appendField('=')

          // TAIL: +/- buttons
          this.appendDummyInput('TAIL')
            .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plus_()))
            .appendField(new Blockly.FieldImage(MINUS_DISABLED_IMG, 20, 20, '-', () => this.minus_()), 'MINUS_BTN')

          this.setInputsInline(true)

          // Mutator gear icon
          this.setMutator(new Blockly.icons.MutatorIcon(
            ['u_var_declare_var_input', 'u_var_declare_var_init_input'], this))
        },

        /** + adds a var_init row at the end */
        plus_: function (this: any) {
          const idx = this.items_.length
          this.items_.push('var_init')
          const defaultNames = ['x', 'y', 'z', 'a', 'b', 'c', 'd', 'e', 'f']
          const defName = defaultNames[idx] || ('v' + idx)
          this.appendValueInput('INIT_' + idx)
            .setCheck('Expression')
            .appendField(', ')
            .appendField(new Blockly.FieldTextInput(defName), 'NAME_' + idx)
            .appendField('=')
          this.moveInputBefore('INIT_' + idx, 'TAIL')
          setMinusState(this, false)
        },

        /** - removes the last row */
        minus_: function (this: any) {
          if (this.items_.length <= 1) return
          const idx = this.items_.length - 1
          const kind = this.items_[idx]
          if (kind === 'var_init') {
            this.removeInput('INIT_' + idx)
          } else {
            this.removeInput('VAR_' + idx)
          }
          this.items_.pop()
          setMinusState(this, this.items_.length <= 1)
        },

        /** Rebuild all variable rows from items_ */
        updateShape_: function (this: any) {
          // Save TYPE dropdown value
          const savedType = this.getFieldValue('TYPE')

          // Remove HEADER if it exists (legacy backwards compat)
          if (this.getInput('HEADER')) this.removeInput('HEADER')

          // Remove all existing var rows
          for (let n = 0; ; n++) {
            if (this.getInput('INIT_' + n)) {
              this.removeInput('INIT_' + n)
            } else if (this.getInput('VAR_' + n)) {
              this.removeInput('VAR_' + n)
            } else {
              break
            }
          }
          // Re-add rows per items_, with HEADER fields on first row
          const defaultNames = ['x', 'y', 'z', 'a', 'b', 'c', 'd', 'e', 'f']
          for (let n = 0; n < this.items_.length; n++) {
            const defName = defaultNames[n] || ('v' + n)
            if (this.items_[n] === 'var_init') {
              const inp = this.appendValueInput('INIT_' + n)
                .setCheck('Expression')
              if (n === 0) {
                inp.appendField(Blockly.Msg['U_VAR_DECLARE_HEADER'] || '宣告')
                  .appendField(new Blockly.FieldDropdown(function() {
                    return getLanguageTypeOptions().filter(([, v]) => v !== 'void')
                  }), 'TYPE')
              } else {
                inp.appendField(', ')
              }
              inp.appendField(new Blockly.FieldTextInput(defName), 'NAME_' + n)
                .appendField('=')
            } else {
              const inp = this.appendDummyInput('VAR_' + n)
              if (n === 0) {
                inp.appendField(Blockly.Msg['U_VAR_DECLARE_HEADER'] || '宣告')
                  .appendField(new Blockly.FieldDropdown(function() {
                    return getLanguageTypeOptions().filter(([, v]) => v !== 'void')
                  }), 'TYPE')
              } else {
                inp.appendField(', ')
              }
              inp.appendField(new Blockly.FieldTextInput(defName), 'NAME_' + n)
            }
            this.moveInputBefore(this.items_[n] === 'var_init' ? 'INIT_' + n : 'VAR_' + n, 'TAIL')
          }

          // Restore TYPE
          if (savedType) {
            this.setFieldValue(savedType, 'TYPE')
          }

          setMinusState(this, this.items_.length <= 1)
        },

        /** Mutator: decompose into mini-workspace blocks */
        decompose: function (this: any, workspace: any) {
          const containerBlock = workspace.newBlock('u_var_declare_container')
          containerBlock.initSvg()
          let connection = containerBlock.nextConnection
          for (let n = 0; n < this.items_.length; n++) {
            const helperType = this.items_[n] === 'var_init'
              ? 'u_var_declare_var_init_input'
              : 'u_var_declare_var_input'
            const itemBlock = workspace.newBlock(helperType)
            itemBlock.initSvg()
            connection.connect(itemBlock.previousConnection)
            connection = itemBlock.nextConnection
          }
          return containerBlock
        },

        /** Mutator: recompose from mini-workspace arrangement */
        compose: function (this: any, containerBlock: any) {
          let block = containerBlock.nextConnection.targetBlock()
          const newItems: string[] = []
          const savedNames: (string | null)[] = []
          const savedConns: any[] = []
          while (block) {
            if (!block.isInsertionMarker()) {
              if (block.type === 'u_var_declare_var_init_input') {
                newItems.push('var_init')
              } else if (block.type === 'u_var_declare_var_input') {
                newItems.push('var')
              }
              savedNames.push(block.savedName_ ?? null)
              savedConns.push(block.savedConn_ ?? null)
            }
            block = block.getNextBlock()
          }
          this.items_ = newItems.length > 0 ? newItems : ['var_init']
          this.updateShape_()
          // Reconnect
          for (let n = 0; n < this.items_.length; n++) {
            if (savedNames[n]) this.setFieldValue(savedNames[n], 'NAME_' + n)
            if (this.items_[n] === 'var_init' && savedConns[n]) {
              savedConns[n].reconnect(this, 'INIT_' + n)
            }
          }
        },

        /** Mutator: save connections before recompose */
        saveConnections: function (this: any, containerBlock: any) {
          let block = containerBlock.nextConnection.targetBlock()
          let idx = 0
          while (block) {
            if (!block.isInsertionMarker()) {
              block.savedName_ = this.getFieldValue('NAME_' + idx)
              if (this.items_[idx] === 'var_init') {
                const inp = this.getInput('INIT_' + idx)
                block.savedConn_ = inp && inp.connection.targetConnection
              } else {
                block.savedConn_ = null
              }
              idx++
            }
            block = block.getNextBlock()
          }
        },

        saveExtraState: function (this: any) {
          return { items: [...this.items_] }
        },

        loadExtraState: function (this: any, state: any) {
          this.items_ = state?.items ?? ['var_init']
          this.updateShape_()
        },

        mutationToDom: function (this: any) {
          const mutation = Blockly.utils.xml.createElement('mutation')
          mutation.setAttribute('items', JSON.stringify(this.items_))
          return mutation
        },

        domToMutation: function (this: any, xml: Element) {
          try {
            this.items_ = JSON.parse(xml.getAttribute('items') || '["var_init"]')
          } catch {
            this.items_ = ['var_init']
          }
          this.updateShape_()
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
        contents: cat.contents.map(block => {
          const entry: Record<string, unknown> = { kind: 'block', type: block.type }
          if (block.extraState) entry.extraState = block.extraState
          return entry
        }),
      })),
    }
  }
}
