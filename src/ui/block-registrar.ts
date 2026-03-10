import * as Blockly from 'blockly'
import { FieldMultilineInput } from '@blockly/field-multilineinput'
import type { BlockSpecRegistry } from '../core/block-spec-registry'
import { CATEGORY_COLORS, DEGRADATION_VISUALS } from './theme/category-colors'
import { IF_INPUTS, WHILE_INPUTS, COUNT_LOOP_INPUTS } from '../blocks/block-input-names'

export interface WorkspaceAccessors {
  getWorkspace: () => Blockly.Workspace | null
}

export class BlockRegistrar {
  private blockSpecRegistry: BlockSpecRegistry
  private accessors: WorkspaceAccessors | null = null

  constructor(blockSpecRegistry: BlockSpecRegistry) {
    this.blockSpecRegistry = blockSpecRegistry
  }

  registerAll(accessors: WorkspaceAccessors): void {
    this.accessors = accessors
    this.registerBlocksFromSpecs()
  }

  // ─── Workspace option helpers (used by dynamic block dropdowns + app.ts) ───

  getWorkspaceVarOptions(): Array<[string, string]> {
    const options: Array<[string, string]> = []
    const seen = new Set<string>()
    const addOption = (name: string) => {
      if (name && !seen.has(name)) {
        seen.add(name)
        options.push([name, name])
      }
    }
    const workspace = this.accessors?.getWorkspace()
    if (workspace) {
      const blocks = workspace.getAllBlocks(false)
      for (const block of blocks) {
        if (block.type === 'u_var_declare') {
          for (let i = 0; ; i++) {
            const name = block.getFieldValue(`NAME_${i}`)
            if (name === null || name === undefined) break
            addOption(name)
          }
        } else if (block.type === 'u_func_def') {
          for (let i = 0; ; i++) {
            const name = block.getFieldValue(`PARAM_${i}`)
            if (name === null || name === undefined) break
            addOption(name)
          }
        } else if (block.type === 'u_count_loop') {
          addOption(block.getFieldValue('VAR'))
        } else if (block.type === 'u_input') {
          for (let i = 0; ; i++) {
            const sel = block.getFieldValue(`SEL_${i}`)
            if (sel !== null && sel !== undefined && sel !== '__COMPOSE__' && sel !== '__CUSTOM__') {
              addOption(sel)
              continue
            }
            const name = block.getFieldValue(`NAME_${i}`)
            if (name !== null && name !== undefined) {
              addOption(name)
              continue
            }
            break
          }
        } else if (block.type === 'c_var_declare_expr') {
          for (let i = 0; ; i++) {
            const name = block.getFieldValue(`NAME_${i}`)
            if (name === null || name === undefined) break
            addOption(name)
          }
        } else if (block.type === 'c_for_loop') {
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

  getScanfVarOptions(): Array<[string, string]> {
    const options: Array<[string, string]> = []
    const seen = new Set<string>()
    const noAddrTypes = new Set(['string', 'char*', 'int*', 'float*', 'double*', 'void*'])

    const workspace = this.accessors?.getWorkspace()
    if (workspace) {
      const blocks = workspace.getAllBlocks(false)
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

  getWorkspaceArrayOptions(currentVal?: string): Array<[string, string]> {
    const options: Array<[string, string]> = []
    const seen = new Set<string>()
    const workspace = this.accessors?.getWorkspace()
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
    if (currentVal && !seen.has(currentVal)) {
      options.push([currentVal, currentVal])
    }
    if (options.length === 0) {
      options.push(['arr', 'arr'])
    }
    return options
  }

  getWorkspaceFuncOptions(currentVal?: string): Array<[string, string]> {
    const options: Array<[string, string]> = []
    const seen = new Set<string>()
    const workspace = this.accessors?.getWorkspace()
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
    if (currentVal && !seen.has(currentVal)) {
      options.unshift([currentVal, currentVal])
    }
    if (options.length === 0) {
      options.push(['myFunction', 'myFunction'])
    }
    return options
  }

  // ─── Private: registration methods ───

  private createOpenDropdown(optionsGenerator: () => Array<[string, string]>): Blockly.FieldDropdown {
    const field = new Blockly.FieldDropdown(optionsGenerator)
    ;(field as any).doClassValidation_ = function (this: any, newValue: string) {
      if (newValue === null || newValue === undefined) return null
      const options = this.getOptions(false)
      if (!options.some((o: string[]) => o[1] === newValue)) {
        options.push([newValue, newValue])
      }
      return newValue
    }
    return field
  }

  private registerBlocksFromSpecs(): void {
    const specs = this.blockSpecRegistry.getAll()
    for (const spec of specs) {
      const blockDef = spec.blockDef
      const blockType = blockDef?.type as string | undefined
      if (!blockType) continue
      if (Blockly.Blocks[blockType]) continue

      Blockly.Blocks[blockType] = {
        init: function (this: Blockly.Block) {
          this.jsonInit(blockDef)
        },
      }
    }

    this.registerDynamicBlocks()
  }

  private registerDynamicBlocks(): void {
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

    // u_string
    {
      Blockly.Blocks['u_string'] = {
        init: function (this: any) {
          const field = new Blockly.FieldTextInput('hello')
          ;(field as any).getDisplayText_ = function (this: any) {
            const val = this.getValue() ?? ''
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
        if (currentVal && !opts.some(o => o[1] === currentVal)) {
          opts.unshift([currentVal, currentVal])
        }
        return opts
      }

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
          for (let i = 0; ; i++) {
            if (!this.getInput(`INIT_${i}`) && !this.getInput(`VAR_${i}`)) break
            if (this.getInput(`INIT_${i}`)) this.removeInput(`INIT_${i}`)
            if (this.getInput(`VAR_${i}`)) this.removeInput(`VAR_${i}`)
          }
          if (this.getInput('TAIL')) this.removeInput('TAIL')
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

    // u_print
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

    // ─── Three-mode argument helpers ───
    const BACK_IMG = 'data:image/svg+xml,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">' +
      '<circle cx="8" cy="8" r="7" fill="#90CAF9"/>' +
      '<path d="M10 5L6 8l4 3" stroke="#fff" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    )
    const COMPOSE_VAL = '__COMPOSE__'
    const CUSTOM_VAL = '__CUSTOM__'

    type ArgMode = 'select' | 'compose' | 'custom'
    interface ArgSlotState { mode: ArgMode; text?: string; selectedVar?: string }

    const buildArgSlot = (block: any, idx: number, mode: ArgMode, opts: {
      getVarOptions: () => Array<[string, string]>,
      inputPrefix?: string,
      separator?: string,
      defaultVar?: string,
      customDefault?: string,
    }) => {
      const inputName = `ARG_${idx}`
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
        ;(dd as any).setValidator(function (this: any, newVal: string) {
          if (newVal === COMPOSE_VAL) {
            setTimeout(() => {
              block.argSlots_[idx] = { mode: 'compose' }
              rebuildArgSlot(block, idx, 'compose', opts)
            }, 0)
            return null
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
      const savedBlock = (mode !== 'compose' && block.getInput(`ARG_${idx}`)?.connection)
        ? block.getInputTargetBlock(`ARG_${idx}`)
        : null
      if (block.getInput(`ARG_${idx}`)) block.removeInput(`ARG_${idx}`)
      buildArgSlot(block, idx, mode, opts)
      const nextInput = block.getInput(`ARG_${idx + 1}`) ? `ARG_${idx + 1}` : 'TAIL'
      block.moveInputBefore(`ARG_${idx}`, nextInput)
      if (savedBlock) {
        try { savedBlock.unplug() } catch (_e) { /* ignore */ }
      }
    }

    // u_input
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
          for (let i = this.argCount_ - 1; i >= 0; i--) {
            if (this.getInput(`ARG_${i}`)) this.removeInput(`ARG_${i}`)
          }
          this.argCount_ = args.length
          // Normalize: ensure selectedVar is set for select mode (buildArgSlot reads it)
          this.argSlots_ = args.map(a =>
            a.mode === 'select' ? { ...a, selectedVar: a.text ?? a.selectedVar } : { ...a }
          )
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

    // c_printf
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
          // Normalize: ensure selectedVar is set for select mode (buildArgSlot reads it)
          this.argSlots_ = args.map((a: ArgSlotState) =>
            a.mode === 'select' ? { ...a, selectedVar: a.text ?? a.selectedVar } : { ...a }
          )
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

    const isArrayVar = (varName: string): boolean => {
      const workspace = self.accessors?.getWorkspace()
      if (!workspace) return false
      for (const block of workspace.getAllBlocks(false)) {
        if (block.type === 'u_array_declare') {
          if (block.getFieldValue('NAME') === varName) return true
        }
      }
      return false
    }

    // c_scanf
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
          // Normalize: ensure selectedVar is set for select mode (buildArgSlot reads it)
          this.argSlots_ = args.map((a: ArgSlotState) =>
            a.mode === 'select' ? { ...a, selectedVar: a.text ?? a.selectedVar } : { ...a }
          )
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

    // u_if
    {
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
          let i = 0
          while (this.getInput(`ELSEIF_CONDITION_${i}`)) {
            this.removeInput(`ELSEIF_CONDITION_${i}`)
            this.removeInput(`ELSEIF_THEN_${i}`)
            i++
          }
          if (this.getInput('ELSE')) this.removeInput('ELSE')
          if (this.getInput('TAIL')) this.removeInput('TAIL')
          for (let j = 0; j < this.elseifCount_; j++) {
            this.appendValueInput(`ELSEIF_CONDITION_${j}`)
              .appendField(Blockly.Msg['U_IF_ELSE_ELSEIF_MSG'] || '否則，如果')
            this.appendStatementInput(`ELSEIF_THEN_${j}`)
              .appendField(Blockly.Msg['U_IF_THEN'] || '則')
          }
          this.appendDummyInput('TAIL')
            .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plusElseIf_()))
            .appendField(new Blockly.FieldImage(
              this.elseifCount_ <= 0 ? MINUS_DISABLED_IMG : MINUS_IMG,
              20, 20, '-', () => this.minusElseIf_()), 'MINUS_BTN')
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

      Blockly.Blocks['u_if_else'] = Blockly.Blocks['u_if']
    }

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

    // u_func_def
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
          const wasAtMin = this.paramCount_ <= 0
          if (this.getInput('PARAMS_LABEL')) this.removeInput('PARAMS_LABEL')
          if (this.getInput('PARAMS_END')) this.removeInput('PARAMS_END')
          if (this.paramCount_ > 0) {
            this.appendDummyInput('PARAMS_LABEL')
              .appendField(Blockly.Msg['U_FUNC_DEF_PARAMS_OPEN'] || '（參數')
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
          if (this.paramCount_ === 1) {
            this.rebuildParamLabels_()
          }
          setMinusState(this, false)
        },
        minusParam_: function (this: any) {
          if (this.paramCount_ <= 0) return
          this.paramCount_--
          this.removeInput(`PARAM_${this.paramCount_}`)
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

    // u_func_call
    {
      Blockly.Blocks['u_func_call'] = {
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

    // u_func_call_expr
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

    // u_var_ref
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

    // u_array_declare
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

    // c_raw_code
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

    // u_var_assign
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

    // c_increment
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

    // c_compound_assign
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

    // c_forward_decl
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

    // c_comment_block
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

    // c_comment_doc
    {
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
          let i = 0
          while (this.getInput(`PARAM_${i}`)) {
            this.removeInput(`PARAM_${i}`)
            i++
          }
          if (this.getInput('RETURN_ROW')) this.removeInput('RETURN_ROW')
          for (let j = 0; j < this.paramCount_; j++) {
            this.appendDummyInput(`PARAM_${j}`)
              .appendField(Blockly.Msg['C_COMMENT_DOC_PARAM'] || '參數')
              .appendField(new Blockly.FieldTextInput('') as Blockly.Field, `PARAM_NAME_${j}`)
              .appendField(new Blockly.FieldTextInput('') as Blockly.Field, `PARAM_DESC_${j}`)
          }
          if (this.hasReturn_) {
            this.appendDummyInput('RETURN_ROW')
              .appendField(Blockly.Msg['C_COMMENT_DOC_RETURN'] || '回傳')
              .appendField(new Blockly.FieldTextInput('') as Blockly.Field, 'RETURN')
          }
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

    // ── Expression versions ──

    // c_increment_expr
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

    // c_compound_assign_expr
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

    // u_input_expr
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
          let i = 0
          while (this.getInput(`ARG_${i}`)) { this.removeInput(`ARG_${i}`); i++ }
          if (this.getInput('TAIL')) this.removeInput('TAIL')
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

    // c_scanf_expr
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
          // Normalize: ensure selectedVar is set for select mode (buildArgSlot reads it)
          this.argSlots_ = args.map((a: ArgSlotState) =>
            a.mode === 'select' ? { ...a, selectedVar: a.text ?? a.selectedVar } : { ...a }
          )
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

    // c_var_declare_expr
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
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }
}
