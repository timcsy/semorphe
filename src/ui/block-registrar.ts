import { allVariableDropdownBlocks } from '../core/variable-dropdown-blocks'
import { conceptsDeclaringVariableType } from '../core/language-executors'
import * as Blockly from 'blockly'
import { FieldMultilineInput } from '@blockly/field-multilineinput'
import type { BlockSpecRegistry } from '../core/block-spec-registry'
import { CATEGORY_COLORS, DEGRADATION_VISUALS } from './theme/category-colors'
import { ARRAY_ACCESS_INPUTS, ARRAY_ASSIGN_INPUTS, COUNT_LOOP_INPUTS, FUNDEF_INPUTS, IF_INPUTS, RETURN_INPUTS, VAR_ASSIGN_INPUTS, WHILE_INPUTS } from '../core/block-input-names'
import { abstractConceptOf } from '../core/language-executors'
import { setFieldSafely } from './field-write'
import { isPlainDeclaration } from '../core/component/traits'
import {
  C_COMPOUND_ASSIGN_INPUTS,
  C_COMPOUND_ASSIGN_EXPR_INPUTS,
  C_VAR_DECLARE_EXPR_INPUTS,
} from '../languages/cpp/block-input-names'

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
        if (block.type === 'cpp_var_declare') {
          for (let i = 0; ; i++) {
            const name = block.getFieldValue(`NAME_${i}`)
            if (name === null || name === undefined) break
            addOption(name)
          }
        } else if (block.type === 'cpp_func_def') {
          for (let i = 0; ; i++) {
            const name = block.getFieldValue(`PARAM_${i}`)
            if (name === null || name === undefined) break
            addOption(name)
          }
        } else if (block.type === 'cpp_loop_count') {
          addOption(block.getFieldValue('VAR'))
        } else if (block.type === 'cpp_input') {
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
        } else if (block.type === 'cpp_var_declare_expression') {
          for (let i = 0; ; i++) {
            const name = block.getFieldValue(`NAME_${i}`)
            if (name === null || name === undefined) break
            addOption(name)
          }
        } else if (isPlainDeclaration(abstractConceptOf(block.type) ?? '')) {
          // 這一行原本是 16 個概念名的寫死清單，全部在講「這些是變數宣告的
          // 一種」——而概念自己就宣告了父概念。見 specs/056-abstract-concept-integrity
          addOption(block.getFieldValue('NAME') ?? '')
        } else if (block.type === 'cpp_loop_for') {
          const initBlock = block.getInputTargetBlock?.('INIT')
          if (initBlock && initBlock.type === 'cpp_var_declare_expression') {
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
        if (block.type === 'cpp_var_declare') {
          const type = block.getFieldValue('TYPE') ?? 'int'
          for (let i = 0; ; i++) {
            const name = block.getFieldValue(`NAME_${i}`)
            if (name === null || name === undefined) break
            varTypes.set(name, type)
          }
        } else if (block.type === 'cpp_array_declare') {
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
        if (block.type === 'cpp_var_declare') {
          for (let i = 0; ; i++) {
            const name = block.getFieldValue(`NAME_${i}`)
            if (name === null || name === undefined) break
            addOption(name)
          }
        } else if (block.type === 'cpp_array_declare') {
          addOption(block.getFieldValue('NAME'))
        } else if (block.type === 'cpp_func_def') {
          for (let i = 0; ; i++) {
            const name = block.getFieldValue(`PARAM_${i}`)
            if (name === null || name === undefined) break
            addOption(name)
          }
        } else if (block.type === 'cpp_loop_count') {
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
        if (block.type === 'cpp_array_declare') {
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

  /**
   * 工作區裡有哪些字串變數，給下拉選單用。
   *
   * **原本寫死 `block.type === 'cpp_string_declare'`。** 那讓介面層認得一個
   * C++ 專屬概念，而且只認得這一個——換一種語言、或多一個同類的概念，
   * 都要回頭改這一行，而沒有任何東西會提醒你。
   *
   * 現在問的是「**哪些概念宣告了字串變數**」，答案來自概念自己的宣告
   * （`concepts.json` 的 `declaresVariableType`）。同一個宣告也餵給同步
   * 控制器的降級——一個事實，兩個消費者。
   */
  private blockTypesDeclaringVariableType(type: string): Set<string> {
    const conceptIds = new Set(conceptsDeclaringVariableType(type))
    const types = new Set<string>()
    for (const spec of this.blockSpecRegistry.getAll()) {
      const cid = spec.conceptMapping?.conceptId
      const blockType = (spec.blockDef as { type?: string } | undefined)?.type
      if (cid && conceptIds.has(cid) && blockType) types.add(blockType)
    }
    return types
  }

  getWorkspaceVariableOptions(variableType: string, currentVal?: string): Array<[string, string]> {
    const options: Array<[string, string]> = []
    const seen = new Set<string>()
    const stringBlockTypes = this.blockTypesDeclaringVariableType(variableType)
    const workspace = this.accessors?.getWorkspace()
    if (workspace) {
      for (const block of workspace.getAllBlocks(false)) {
        if (stringBlockTypes.has(block.type)) {
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
      options.push(['str', 'str'])
    }
    return options
  }

  getWorkspaceFuncOptions(currentVal?: string): Array<[string, string]> {
    const options: Array<[string, string]> = []
    const seen = new Set<string>()
    const workspace = this.accessors?.getWorkspace()
    if (workspace) {
      for (const block of workspace.getAllBlocks(false)) {
        if (block.type === 'cpp_func_def') {
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

    // cpp_literal_string
    {
      Blockly.Blocks['cpp_literal_string'] = {
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

      Blockly.Blocks['cpp_var_declare'] = {
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

    // cpp_array_2d_declare —— `int a[2][3] = {{1,2,3},{4,5,6}}`
    // ⚠️ 命令式，理由與 `cpp_array_declare` 相同（初始值要動態插槽）。
    // 🔴 而它的插槽接的是**一顆 `cpp_initializer_list` 積木**——那就是巢狀。
    {
      Blockly.Blocks['cpp_array_2d_declare'] = {
        itemCount_: 0,
        init: function (this: any) {
          this.itemCount_ = 0
          this.appendDummyInput('HEAD')
            .appendField(Blockly.Msg['C_ARRAY_2D_DECLARE_CREATE'] || '建立')
            .appendField(new Blockly.FieldDropdown([
              [Blockly.Msg['_VAR_DECLARE_TYPE_INT'] || 'int', 'int'],
              [Blockly.Msg['_VAR_DECLARE_TYPE_DOUBLE'] || 'double', 'double'],
              [Blockly.Msg['_VAR_DECLARE_TYPE_CHAR'] || 'char', 'char']
            ]), 'TYPE')
            .appendField(Blockly.Msg['C_ARRAY_2D_DECLARE_ARRAY'] || '二維陣列')
            .appendField(new Blockly.FieldTextInput('arr'), 'NAME')
            .appendField(Blockly.Msg['C_ARRAY_2D_DECLARE_ROWS'] || '列數')
            .appendField(new Blockly.FieldTextInput('3'), 'ROWS')
            .appendField(Blockly.Msg['C_ARRAY_2D_DECLARE_COLS'] || '行數')
            .appendField(new Blockly.FieldTextInput('4'), 'COLS')
          // ⚠️ **「初始值」的標籤不在這裡**——TAIL 只放按鈕。
          // 動態插槽是 `moveInputBefore(…, 'TAIL')` 插進來的，所以放在 TAIL 上的
          // 標籤會**跑到所有值的後面**（`大小 3 [1][2][3] 初始值 ⊕⊖`）。
          // 標籤跟著**第一個插槽**走（見 `plus_`），與 `cpp_print` 同一個做法。
          this.appendDummyInput('TAIL')
            .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plus_()))
            .appendField(new Blockly.FieldImage(MINUS_DISABLED_IMG, 20, 20, '-', () => this.minus_()), 'MINUS_BTN')
          this.setInputsInline(true)
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setColour(CATEGORY_COLORS.arrays)
          this.setTooltip(Blockly.Msg['C_ARRAY_2D_DECLARE_TOOLTIP'] || '建立一個二維陣列')
        },
        plus_: function (this: any) {
          const idx = this.itemCount_
          const inp = this.appendValueInput('EXPR' + idx).setCheck('Expression')
          // **標籤跟著第一個插槽**——沒有初始值時它也不該出現
          if (idx === 0) inp.appendField(Blockly.Msg['C_ARRAY_2D_DECLARE_INIT'] || '初始值')
          this.moveInputBefore('EXPR' + idx, 'TAIL')
          this.itemCount_++
          setMinusState(this, false)
        },
        minus_: function (this: any) {
          if (this.itemCount_ <= 0) return
          this.itemCount_--
          this.removeInput('EXPR' + this.itemCount_)
          setMinusState(this, this.itemCount_ <= 0)
        },
        saveExtraState: function (this: any) { return { itemCount: this.itemCount_ } },
        loadExtraState: function (this: any, state: { itemCount?: number }) {
          const count = state?.itemCount ?? 0
          while (this.itemCount_ < count) this.plus_()
        },
      }
    }

    // cpp_vector_declare —— `vector<int> v = {1,2,3}`
    {
      Blockly.Blocks['cpp_vector_declare'] = {
        itemCount_: 0,
        init: function (this: any) {
          this.itemCount_ = 0
          this.appendDummyInput('HEAD')
            .appendField(Blockly.Msg['CPP_VECTOR_DECLARE_CREATE'] || '建立')
            .appendField(new Blockly.FieldDropdown([
              [Blockly.Msg['PP_VECTOR_DECLARE_TYPE_INT'] || 'int', 'int'],
              [Blockly.Msg['PP_VECTOR_DECLARE_TYPE_FLOAT'] || 'float', 'float'],
              [Blockly.Msg['PP_VECTOR_DECLARE_TYPE_DOUBLE'] || 'double', 'double'],
              [Blockly.Msg['PP_VECTOR_DECLARE_TYPE_CHAR'] || 'char', 'char'],
              [Blockly.Msg['PP_VECTOR_DECLARE_TYPE_STRING'] || 'std::string', 'std::string'],
              [Blockly.Msg['PP_VECTOR_DECLARE_TYPE_LONG_LONG'] || 'long long', 'long long']
            ]), 'TYPE')
            .appendField(Blockly.Msg['CPP_VECTOR_DECLARE_LIST'] || '列表')
            .appendField(new Blockly.FieldTextInput('vec'), 'NAME')
          // ⚠️ **「初始值」的標籤不在這裡**——TAIL 只放按鈕。
          // 動態插槽是 `moveInputBefore(…, 'TAIL')` 插進來的，所以放在 TAIL 上的
          // 標籤會**跑到所有值的後面**（`大小 3 [1][2][3] 初始值 ⊕⊖`）。
          // 標籤跟著**第一個插槽**走（見 `plus_`），與 `cpp_print` 同一個做法。
          this.appendDummyInput('TAIL')
            .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plus_()))
            .appendField(new Blockly.FieldImage(MINUS_DISABLED_IMG, 20, 20, '-', () => this.minus_()), 'MINUS_BTN')
          this.setInputsInline(true)
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setColour(CATEGORY_COLORS.cpp_containers)
          this.setTooltip(Blockly.Msg['CPP_VECTOR_DECLARE_TOOLTIP'] || '建立一個列表')
        },
        plus_: function (this: any) {
          const idx = this.itemCount_
          const inp = this.appendValueInput('EXPR' + idx).setCheck('Expression')
          // **標籤跟著第一個插槽**——沒有初始值時它也不該出現
          if (idx === 0) inp.appendField(Blockly.Msg['CPP_VECTOR_DECLARE_INIT'] || '初始值')
          this.moveInputBefore('EXPR' + idx, 'TAIL')
          this.itemCount_++
          setMinusState(this, false)
        },
        minus_: function (this: any) {
          if (this.itemCount_ <= 0) return
          this.itemCount_--
          this.removeInput('EXPR' + this.itemCount_)
          setMinusState(this, this.itemCount_ <= 0)
        },
        saveExtraState: function (this: any) { return { itemCount: this.itemCount_ } },
        loadExtraState: function (this: any, state: { itemCount?: number }) {
          const count = state?.itemCount ?? 0
          while (this.itemCount_ < count) this.plus_()
        },
      }
    }

    // cpp_array_declare —— `int a[3] = {1,2,3}`
    //
    // ⚠️ **從宣告式改成命令式**（2026-08-14），理由是初始值需要**動態插槽**。
    // 🔴 不改的話 `= {1,2,3}` 在積木上不存在，而**一動積木重生成就掉了**
    // ——使用者開瀏覽器實測撞到的正是這個。
    {
      Blockly.Blocks['cpp_array_declare'] = {
        itemCount_: 0,
        init: function (this: any) {
          this.itemCount_ = 0
          this.appendDummyInput('HEAD')
            .appendField(Blockly.Msg['U_ARRAY_DECLARE_CREATE'] || '建立')
            .appendField(new Blockly.FieldDropdown([
              [Blockly.Msg['_ARRAY_DECLARE_TYPE_INT'] || 'int', 'int'],
              [Blockly.Msg['_ARRAY_DECLARE_TYPE_FLOAT'] || 'float', 'float'],
              [Blockly.Msg['_ARRAY_DECLARE_TYPE_DOUBLE'] || 'double', 'double'],
              [Blockly.Msg['_ARRAY_DECLARE_TYPE_CHAR'] || 'char', 'char'],
              [Blockly.Msg['_ARRAY_DECLARE_TYPE_LONG_LONG'] || 'long long', 'long long']
            ]), 'TYPE')
            .appendField(Blockly.Msg['U_ARRAY_DECLARE_ARRAY'] || '陣列')
            .appendField(new Blockly.FieldTextInput('arr'), 'NAME')
          this.appendValueInput('SIZE')
            .setCheck('Expression')
            .appendField(Blockly.Msg['U_ARRAY_DECLARE_SIZE'] || '大小')
          // ⚠️ **「初始值」的標籤不在這裡**——TAIL 只放按鈕。
          // 動態插槽是 `moveInputBefore(…, 'TAIL')` 插進來的，所以放在 TAIL 上的
          // 標籤會**跑到所有值的後面**（`大小 3 [1][2][3] 初始值 ⊕⊖`）。
          // 標籤跟著**第一個插槽**走（見 `plus_`），與 `cpp_print` 同一個做法。
          this.appendDummyInput('TAIL')
            .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plus_()))
            .appendField(new Blockly.FieldImage(MINUS_DISABLED_IMG, 20, 20, '-', () => this.minus_()), 'MINUS_BTN')
          this.setInputsInline(true)
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setColour(CATEGORY_COLORS.arrays)
          this.setTooltip(Blockly.Msg['U_ARRAY_DECLARE_TOOLTIP'] || '建立一個固定大小的陣列')
        },
        plus_: function (this: any) {
          const idx = this.itemCount_
          const inp = this.appendValueInput('EXPR' + idx).setCheck('Expression')
          // **標籤跟著第一個插槽**——沒有初始值時它也不該出現
          if (idx === 0) inp.appendField(Blockly.Msg['U_ARRAY_DECLARE_INIT'] || '初始值')
          this.moveInputBefore('EXPR' + idx, 'TAIL')
          this.itemCount_++
          setMinusState(this, false)
        },
        minus_: function (this: any) {
          if (this.itemCount_ <= 0) return
          this.itemCount_--
          this.removeInput('EXPR' + this.itemCount_)
          setMinusState(this, this.itemCount_ <= 0)
        },
        saveExtraState: function (this: any) {
          return { itemCount: this.itemCount_ }
        },
        loadExtraState: function (this: any, state: { itemCount?: number }) {
          const count = state?.itemCount ?? 0
          while (this.itemCount_ < count) this.plus_()
        },
      }
    }

    // cpp_initializer_list —— `{1, 2, 3}`
    //
    // ⚠️ **動態插槽必須是命令式的**：`+`／`-` 按鈕要在 `init` 裡建，
    // 而宣告式的 `args0` 只描述固定的欄位。與 `cpp_print` 同一個形狀。
    //
    // 🔴 而它讓**多維初始值在積木上表達得出來**：外層的插槽接一顆同型別的積木，
    // 巢狀天然支援——插槽群沒有巢狀，所以 `{{1,2},{3,4}}` 用插槽群裝不下。
    {
      Blockly.Blocks['cpp_initializer_list'] = {
        itemCount_: 1,
        init: function (this: any) {
          this.itemCount_ = 1
          this.appendValueInput('EXPR0')
            .appendField(Blockly.Msg['CPP_INITIALIZER_LIST_MSG'] || '初始值')
          this.appendDummyInput('TAIL')
            .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plus_()))
            .appendField(new Blockly.FieldImage(MINUS_DISABLED_IMG, 20, 20, '-', () => this.minus_()), 'MINUS_BTN')
          this.setInputsInline(true)
          this.setOutput(true, 'Expression')
          this.setColour(CATEGORY_COLORS.arrays)
          this.setTooltip(Blockly.Msg['CPP_INITIALIZER_LIST_TOOLTIP'] || '一組依序排列的初始值')
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

    // cpp_print
    {
      Blockly.Blocks['cpp_print'] = {
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
        // 這一個**刻意**保留吞掉：`unplug()` 在積木已經拔掉時會擲錯，那是
        // 正常情形而不是缺陷。與 setFieldSafely 那 15 個不同——那些吞的是
        // 「欄位名對不上」，是已知會發生的**缺陷**。
        try { savedBlock.unplug() } catch (_e) { /* 已經拔掉了，正常 */ }
      }
    }

    // cpp_input
    {
      Blockly.Blocks['cpp_input'] = {
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
          setFieldSafely(this, 'SEL_0', 'x')
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
          setFieldSafely(this, `SEL_${idx}`, 'v' + idx)
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
              setFieldSafely(this, `SEL_${i}`, a.text)
            }
          }
          setMinusState(this, this.argCount_ <= 1)
        },
      }
    }

    // cpp_print_formatted
    {
      Blockly.Blocks['cpp_print_formatted'] = {
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
          setFieldSafely(this, 'SEL_0', 'x')
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
          setFieldSafely(this, `SEL_${idx}`, 'x')
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
              setFieldSafely(this, `SEL_${i}`, a.text)
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
        if (block.type === 'cpp_array_declare') {
          if (block.getFieldValue('NAME') === varName) return true
        }
      }
      return false
    }

    // cpp_input_formatted
    {
      Blockly.Blocks['cpp_input_formatted'] = {
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
          setFieldSafely(this, 'SEL_0', 'x')
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
          setFieldSafely(this, `SEL_${idx}`, 'x')
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
              setFieldSafely(this, `SEL_${i}`, a.text)
            }
          }
          setMinusState(this, this.argCount_ <= 0)
        },
      }
    }

    // cpp_endl
    {
      Blockly.Blocks['cpp_endl'] = {
        init: function (this: Blockly.Block) {
          this.appendDummyInput()
            .appendField(Blockly.Msg['U_ENDL_MSG0'] || '換行')
          this.setOutput(true, 'Expression')
          this.setColour(CATEGORY_COLORS.io)
          this.setTooltip(Blockly.Msg['U_ENDL_TOOLTIP'] || '換行')
        },
      }
    }

    // cpp_if
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

      Blockly.Blocks['cpp_if'] = {
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

      Blockly.Blocks['cpp_if_else'] = Blockly.Blocks['cpp_if']
    }

    // cpp_loop_while
    {
      Blockly.Blocks['cpp_loop_while'] = {
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

    // cpp_loop_count
    {
      Blockly.Blocks['cpp_loop_count'] = {
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

    // cpp_break, cpp_continue
    {
      Blockly.Blocks['cpp_break'] = {
        init: function (this: Blockly.Block) {
          this.appendDummyInput().appendField(Blockly.Msg['U_BREAK_MSG'] || '跳出迴圈')
          this.setPreviousStatement(true, 'Statement')
          this.setColour(CATEGORY_COLORS.control)
          this.setTooltip(Blockly.Msg['U_BREAK_TOOLTIP'] || '立刻停止迴圈，不再重複')
        },
      }
    }
    {
      Blockly.Blocks['cpp_continue'] = {
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

    /**
     * **參數列**——「型別下拉（＋可選的名字輸入）× N，外面包括號，右邊一組 ＋／−」
     *
     * ## 為什麼是工廠
     *
     * `cpp_func_def` 與 `cpp_forward_decl` 原本各有一份，而它們是**同一份程式碼的
     * 兩份拷貝**：`loadExtraState` 100% 相同、`minusParam_` 96%、`plusParam_` 89%。
     *
     * 而**兩份已經開始漂移**——`cpp_forward_decl` 的括號寫死 `'('`／`')'`，
     * `cpp_func_def` 走 `Blockly.Msg`。那不是設計，是抄過去的時候漏掉的。
     *
     * > 抽出來不是為了讓第三顆好加，是**因為它已經重複了**。
     * > （判準見 `knowledge/history/033`：一個操作值不值得固化，看的不是重複幾次，
     * > 而是**重做時會不會漏掉上次學到的東西**——抄的時候就漏了 i18n。）
     *
     * ## 三個變異點，全部是資料
     *
     * | | `cpp_func_def` | `cpp_forward_decl` |
     * |---|---|---|
     * | 帶名字欄位 | ✅ `int a` | ❌ `int f(int, int);` |
     * | 括號標籤 | `（參數`／`）` | `(`／`)` |
     * | `PARAMS_END` 移到誰之前 | `'BODY'` | 不移 |
     *
     * ## ⚠️ 這一段沒有自動化測試
     *
     * `happy-dom` 跑不動 Blockly 12 的 FocusManager，而 `renderToBlocklyState`
     * 產的是純 JSON、**完全不經過 `Blockly.Blocks`**。
     * `tests/unit/ui/block-registrar.test.ts` 的四支測試是 **grep 這個檔的文字**。
     *
     * **它們全綠不代表這裡是對的。改這一段必須開瀏覽器。**
     */
    const defParamList = (
      target: any,
      config: {
        /** 每個參數要不要一個名字輸入框 */
        withNameField: boolean
        /** 開括號的 i18n 鍵與 fallback。⚠️ fallback 必須是原本顯示的字元 */
        openParen: [key: string, rawChar: string]
        closeParen: [key: string, rawChar: string]
        /** `PARAMS_END` 要移到哪個 input 之前；`null` = 不移 */
        moveTailTo: string | null
      },
    ): void => {
      const message = ([key, original]: [string, string]): string => Blockly.Msg[key] || original

      target.paramCount_ = 0

      target.rebuildParamLabels_ = function (this: any): void {
        const wasAtMin = this.paramCount_ <= 0
        if (this.getInput('PARAMS_LABEL')) this.removeInput('PARAMS_LABEL')
        if (this.getInput('PARAMS_END')) this.removeInput('PARAMS_END')
        if (this.paramCount_ > 0) {
          this.appendDummyInput('PARAMS_LABEL').appendField(message(config.openParen))
          this.moveInputBefore('PARAMS_LABEL', 'PARAM_0')
          this.appendDummyInput('PARAMS_END')
            .appendField(message(config.closeParen))
            .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plusParam_()))
            .appendField(
              new Blockly.FieldImage(wasAtMin ? MINUS_DISABLED_IMG : MINUS_IMG, 20, 20, '-', () => this.minusParam_()),
              'MINUS_BTN',
            )
        } else {
          this.appendDummyInput('PARAMS_LABEL')
          this.appendDummyInput('PARAMS_END')
            .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plusParam_()))
            .appendField(
              new Blockly.FieldImage(MINUS_DISABLED_IMG, 20, 20, '-', () => this.minusParam_()),
              'MINUS_BTN',
            )
        }
        if (config.moveTailTo) this.moveInputBefore('PARAMS_END', config.moveTailTo)
      }

      target.plusParam_ = function (this: any): void {
        const idx = this.paramCount_
        const input = this.appendDummyInput(`PARAM_${idx}`)
        if (idx > 0) input.appendField(',')
        input.appendField(self.createOpenDropdown(getParamTypeOptions) as Blockly.Field, `TYPE_${idx}`)
        if (config.withNameField) {
          input.appendField(new Blockly.FieldTextInput(`p${idx}`) as Blockly.Field, `PARAM_${idx}`)
        }
        this.moveInputBefore(`PARAM_${idx}`, 'PARAMS_END')
        this.paramCount_++
        if (this.paramCount_ === 1) this.rebuildParamLabels_()
        setMinusState(this, false)
      }

      target.minusParam_ = function (this: any): void {
        if (this.paramCount_ <= 0) return
        this.paramCount_--
        this.removeInput(`PARAM_${this.paramCount_}`)
        if (this.paramCount_ === 0) this.rebuildParamLabels_()
        setMinusState(this, this.paramCount_ <= 0)
      }

      target.saveExtraState = function (this: any): { paramCount: number } | null {
        return this.paramCount_ > 0 ? { paramCount: this.paramCount_ } : null
      }

      // ⚠️ **靠反覆呼叫 `plusParam_` 重建，不要改成直接設 `paramCount_`。**
      // 舊存檔只存了數字，插槽是這裡長出來的——改掉這個機制，舊存檔就載不回來。
      target.loadExtraState = function (this: any, state: { paramCount?: number }): void {
        const count = state?.paramCount ?? 0
        while (this.paramCount_ < count) this.plusParam_()
      }
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

    // cpp_func_def
    /* eslint-disable @typescript-eslint/no-explicit-any */
    {
      Blockly.Blocks['cpp_func_def'] = {
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
          this.appendStatementInput(FUNDEF_INPUTS.statement[0])
          this.setInputsInline(true)
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setColour(CATEGORY_COLORS.functions)
          this.setTooltip(Blockly.Msg['U_FUNC_DEF_TOOLTIP'] || '定義函式')
        },
      }
      // 參數列（型別 ＋ 名字）由工廠提供——與 `cpp_forward_decl` 共用同一份。
      defParamList(Blockly.Blocks['cpp_func_def'], {
        withNameField: true,
        openParen: ['U_FUNC_DEF_PARAMS_OPEN', '（參數'],
        closeParen: ['U_FUNC_DEF_PARAMS_CLOSE', '）'],
        moveTailTo: 'BODY',
      })
    }

    // cpp_func_call
    {
      Blockly.Blocks['cpp_func_call'] = {
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

    // cpp_func_call_expression
    {
      Blockly.Blocks['cpp_func_call_expression'] = {
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

    // cpp_return
    {
      Blockly.Blocks['cpp_return'] = {
        init: function (this: Blockly.Block) {
          this.appendValueInput(RETURN_INPUTS.value[0])
            .appendField(Blockly.Msg['U_RETURN_MSG'] || '回傳')
          this.setPreviousStatement(true, 'Statement')
          this.setColour(CATEGORY_COLORS.functions)
          this.setTooltip(Blockly.Msg['U_RETURN_TOOLTIP'] || '回傳值')
        },
      }
    }

    // cpp_var_ref
    {
      Blockly.Blocks['cpp_var_ref'] = {
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

    // ⚠️ ~~`cpp_array_declare` 的舊定義原本在這裡~~ —— **2026-08-14 刪除**。
    //
    // 🔴 它與上面那個新定義（動態插槽）**是同一個鍵**，而**後定義的贏**
    // ——於是新的那個從來沒有生效過。而舊的用
    // `ARRAY_DECLARE_INPUTS.value[0]`，那個常數是**從 `blocks.json` 的
    // `args0` 導出的**（`core/block-input-names.ts`）：把 `args0` 移除之後
    // 它變成**空字串**，`appendValueInput('')` 拋錯。
    //
    // 症狀是**整個 flyout 停在那一顆**——使用者打開「陣列與列表」只看到一顆積木，
    // 而 console 是乾淨的（Blockly 把它吞在 flyout 的建構裡）。
    //
    // > **同一個鍵被賦值兩次，第二次是靜默的覆蓋
    // > ——而雙重真相護欄看的是「JSON 與命令式」，看不到「命令式與命令式」。**

    // cpp_raw_code
    {
      Blockly.Blocks['cpp_raw_code'] = {
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

    // cpp_array_at
    {
      Blockly.Blocks['cpp_array_at'] = {
        init: function (this: Blockly.Block) {
          this.appendValueInput(ARRAY_ACCESS_INPUTS.value[0])
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

    // ── 有工作區變數下拉選單的積木
    //
    // 這一類**沒辦法用純 JSON 定義**：欄位的選項要從即時工作區算出來。
    // 建構程式碼住在這裡是對的（它是 Blockly 的機制），但**「哪些積木要用
    // 它」不是介面層的知識**——原本這裡直接寫 `Blockly.Blocks['cpp_string_at']`，
    // 一個 C++ 專屬身分寫死在呈現層。
    //
    // 名單由語言套件宣告（`core/variable-dropdown-blocks.ts`）。
    // 列哪些變數也是宣告的，所以加一個新的字串宣告概念時這裡自動涵蓋它。
    for (const d of allVariableDropdownBlocks()) {
      const KEY = d.blockType.toUpperCase()
      Blockly.Blocks[d.blockType] = {
        init: function (this: Blockly.Block) {
          this.appendValueInput(d.valueInput)
            .appendField(Blockly.Msg[`${KEY}_LABEL`] || '取得字串')
            .appendField(
              self.createOpenDropdown(() =>
                self.getWorkspaceVariableOptions(d.variableType, this.getFieldValue(d.field) ?? undefined),
              ) as Blockly.Field,
              d.field,
            )
            .appendField(Blockly.Msg[`${KEY}_INDEX_LABEL`] || '第 [')
          this.appendDummyInput().appendField(Blockly.Msg[`${KEY}_END_LABEL`] || '] 個字元')
          this.setInputsInline(true)
          this.setOutput(true, 'Expression')
          this.setColour(d.colour)
          this.setTooltip(Blockly.Msg[`${KEY}_TOOLTIP`] || '取得字串指定位置的字元')
        },
      }
    }

    // cpp_array_assign
    {
      Blockly.Blocks['cpp_array_assign'] = {
        init: function (this: Blockly.Block) {
          this.appendValueInput(ARRAY_ASSIGN_INPUTS.value[0])
            .appendField(Blockly.Msg['U_ARRAY_ASSIGN_SET_LABEL'] || '設定 陣列')
            .appendField(self.createOpenDropdown(() => self.getWorkspaceArrayOptions()) as Blockly.Field, 'NAME')
            .appendField(Blockly.Msg['U_ARRAY_ACCESS_AT_LABEL'] || '的第 [')
          this.appendValueInput(ARRAY_ASSIGN_INPUTS.value[1])
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

    // cpp_var_assign
    {
      Blockly.Blocks['cpp_var_assign'] = {
        init: function (this: Blockly.Block) {
          this.appendValueInput(VAR_ASSIGN_INPUTS.value[0])
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

    // cpp_increment
    {
      Blockly.Blocks['cpp_increment'] = {
        hasIndex_: false,
        init: function (this: any) {
          this.hasIndex_ = false
          this.buildInputs_()
          this.setPreviousStatement(true, null)
          this.setNextStatement(true, null)
          this.setColour(CATEGORY_COLORS.operators)
          this.setTooltip(Blockly.Msg['C_INCREMENT_TOOLTIP'] || '讓變數的值加 1 或減 1')
        },
        buildInputs_: function (this: any) {
          // Save current field values before rebuild
          const savedName = this.getField('NAME') ? this.getFieldValue('NAME') : null
          const savedOp = this.getField('OP') ? this.getFieldValue('OP') : null
          const savedPos = this.getField('POSITION') ? this.getFieldValue('POSITION') : null
          const savedIndex = this.getInput('INDEX') ? this.getInputTargetBlock('INDEX') : null
          // Remove existing inputs
          if (this.getInput('MAIN')) this.removeInput('MAIN')
          if (this.getInput('INDEX')) this.removeInput('INDEX', true)
          if (this.getInput('TAIL')) this.removeInput('TAIL')

          if (this.hasIndex_) {
            this.appendValueInput('INDEX')
              .setCheck('Expression')
              .appendField(Blockly.Msg['C_INCREMENT_VAR_LABEL'] || '變數')
              .appendField(new Blockly.FieldDropdown(() => self.getWorkspaceVarOptions()) as Blockly.Field, 'NAME')
              .appendField('的第 [')
            this.appendDummyInput('TAIL')
              .appendField('] 格')
              .appendField(new Blockly.FieldDropdown([
                [Blockly.Msg['C_INCREMENT_OP_INCREMENT'] || '加 1（++）', '++'],
                [Blockly.Msg['C_INCREMENT_OP_DECREMENT'] || '減 1（--）', '--'],
              ]) as Blockly.Field, 'OP')
              .appendField(new Blockly.FieldDropdown([
                [Blockly.Msg['C_INCREMENT_POS_POSTFIX'] || '後置', 'postfix'],
                [Blockly.Msg['C_INCREMENT_POS_PREFIX'] || '前置', 'prefix'],
              ]) as Blockly.Field, 'POSITION')
          } else {
            this.appendDummyInput('MAIN')
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
          }
          this.setInputsInline(true)
          // Restore saved values
          if (savedName) this.setFieldValue(savedName, 'NAME')
          if (savedOp) this.setFieldValue(savedOp, 'OP')
          if (savedPos) this.setFieldValue(savedPos, 'POSITION')
          if (savedIndex && this.getInput('INDEX')) {
            this.getInput('INDEX')!.connection?.connect(savedIndex.outputConnection)
          }
        },
        saveExtraState: function (this: any) {
          if (!this.hasIndex_) return {}
          return { hasIndex: true }
        },
        loadExtraState: function (this: any, state: { hasIndex?: boolean }) {
          const needIndex = !!state?.hasIndex
          if (needIndex !== this.hasIndex_) {
            this.hasIndex_ = needIndex
            this.buildInputs_()
          }
        },
      }
    }

    // cpp_var_assign_compound
    {
      Blockly.Blocks['cpp_var_assign_compound'] = {
        hasIndex_: false,
        init: function (this: any) {
          this.hasIndex_ = false
          this.buildInputs_()
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setColour(CATEGORY_COLORS.operators)
          this.setTooltip(Blockly.Msg['C_COMPOUND_ASSIGN_TOOLTIP'] || '把變數的值加上、減去、乘以、除以或取餘數後存回去')
        },
        buildInputs_: function (this: any) {
          const savedName = this.getField('NAME') ? this.getFieldValue('NAME') : null
          const savedOp = this.getField('OP') ? this.getFieldValue('OP') : null
          const savedIndex = this.getInput('INDEX') ? this.getInputTargetBlock('INDEX') : null
          const savedValue = this.getInput(C_COMPOUND_ASSIGN_INPUTS.value[0]) ? this.getInputTargetBlock('VALUE') : null
          if (this.getInput('INDEX')) this.removeInput('INDEX', true)
          if (this.getInput('INDEX_LABEL')) this.removeInput('INDEX_LABEL')
          if (this.getInput(C_COMPOUND_ASSIGN_INPUTS.value[0])) this.removeInput('VALUE', true)

          if (this.hasIndex_) {
            this.appendValueInput('INDEX')
              .setCheck('Expression')
              .appendField(Blockly.Msg['C_COMPOUND_ASSIGN_VAR_LABEL'] || '把變數')
              .appendField(new Blockly.FieldDropdown(() => self.getWorkspaceVarOptions()) as Blockly.Field, 'NAME')
              .appendField('的第 [')
            this.appendValueInput(C_COMPOUND_ASSIGN_INPUTS.value[0])
              .setCheck('Expression')
              .appendField('] 格')
              .appendField(new Blockly.FieldDropdown([
                [Blockly.Msg['C_COMPOUND_ASSIGN_OP_PLUS_EQ'] || '加上（+=）', '+='],
                [Blockly.Msg['C_COMPOUND_ASSIGN_OP_MINUS_EQ'] || '減去（-=）', '-='],
                [Blockly.Msg['C_COMPOUND_ASSIGN_OP_TIMES_EQ'] || '乘以（*=）', '*='],
                [Blockly.Msg['C_COMPOUND_ASSIGN_OP_DIVIDE_EQ'] || '除以（/=）', '/='],
                [Blockly.Msg['C_COMPOUND_ASSIGN_OP_REMAINDER_EQ'] || '取餘數（%=）', '%='],
              ]) as Blockly.Field, 'OP')
          } else {
            this.appendValueInput(C_COMPOUND_ASSIGN_INPUTS.value[0])
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
          }
          this.setInputsInline(true)
          if (savedName) this.setFieldValue(savedName, 'NAME')
          if (savedOp) this.setFieldValue(savedOp, 'OP')
          if (savedIndex && this.getInput('INDEX')) {
            this.getInput('INDEX')!.connection?.connect(savedIndex.outputConnection)
          }
          if (savedValue && this.getInput(C_COMPOUND_ASSIGN_INPUTS.value[0])) {
            this.getInput(C_COMPOUND_ASSIGN_INPUTS.value[0])!.connection?.connect(savedValue.outputConnection)
          }
        },
        saveExtraState: function (this: any) {
          if (!this.hasIndex_) return {}
          return { hasIndex: true }
        },
        loadExtraState: function (this: any, state: { hasIndex?: boolean }) {
          const needIndex = !!state?.hasIndex
          if (needIndex !== this.hasIndex_) {
            this.hasIndex_ = needIndex
            this.buildInputs_()
          }
        },
      }
    }

    // cpp_forward_decl
    {
      Blockly.Blocks['cpp_forward_decl'] = {
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
      }
      // 參數列（只有型別，沒有名字——前向宣告不需要）由同一個工廠提供。
      // ⚠️ 括號改走 `Blockly.Msg`，**fallback 是原本的 `(`／`)`**——
      // 翻譯鍵補上之前顯示完全不變。原本沒走 i18n 是抄過去時漏掉的。
      defParamList(Blockly.Blocks['cpp_forward_decl'], {
        withNameField: false,
        openParen: ['C_FORWARD_DECL_PARAMS_OPEN', '('],
        closeParen: ['C_FORWARD_DECL_PARAMS_CLOSE', ')'],
        moveTailTo: null,
      })
    }

    // cpp_comment
    {
      Blockly.Blocks['cpp_comment'] = {
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

    // cpp_block_comment
    {
      Blockly.Blocks['cpp_block_comment'] = {
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

    // cpp_doc_comment
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

      Blockly.Blocks['cpp_doc_comment'] = {
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

    // cpp_increment_expression
    {
      Blockly.Blocks['cpp_increment_expression'] = {
        hasIndex_: false,
        init: function (this: any) {
          this.hasIndex_ = false
          this.buildInputs_()
          this.setOutput(true, 'Expression')
          this.setColour(CATEGORY_COLORS.operators)
          this.setTooltip(Blockly.Msg['C_INCREMENT_TOOLTIP'] || '遞增/遞減（運算式）')
        },
        buildInputs_: function (this: any) {
          const savedName = this.getField('NAME') ? this.getFieldValue('NAME') : null
          const savedOp = this.getField('OP') ? this.getFieldValue('OP') : null
          const savedPos = this.getField('POSITION') ? this.getFieldValue('POSITION') : null
          const savedIndex = this.getInput('INDEX') ? this.getInputTargetBlock('INDEX') : null
          if (this.getInput('MAIN')) this.removeInput('MAIN')
          if (this.getInput('INDEX')) this.removeInput('INDEX', true)
          if (this.getInput('TAIL')) this.removeInput('TAIL')

          if (this.hasIndex_) {
            this.appendValueInput('INDEX')
              .setCheck('Expression')
              .appendField(new Blockly.FieldDropdown(() => self.getWorkspaceVarOptions()) as Blockly.Field, 'NAME')
              .appendField('[')
            this.appendDummyInput('TAIL')
              .appendField(']')
              .appendField(new Blockly.FieldDropdown([
                [Blockly.Msg['C_INCREMENT_OP_INCREMENT'] || '++', '++'],
                [Blockly.Msg['C_INCREMENT_OP_DECREMENT'] || '--', '--'],
              ]) as Blockly.Field, 'OP')
              .appendField(new Blockly.FieldDropdown([
                [Blockly.Msg['C_INCREMENT_POS_POSTFIX'] || '後置', 'postfix'],
                [Blockly.Msg['C_INCREMENT_POS_PREFIX'] || '前置', 'prefix'],
              ]) as Blockly.Field, 'POSITION')
          } else {
            this.appendDummyInput('MAIN')
              .appendField(new Blockly.FieldDropdown(() => self.getWorkspaceVarOptions()) as Blockly.Field, 'NAME')
              .appendField(new Blockly.FieldDropdown([
                [Blockly.Msg['C_INCREMENT_OP_INCREMENT'] || '++', '++'],
                [Blockly.Msg['C_INCREMENT_OP_DECREMENT'] || '--', '--'],
              ]) as Blockly.Field, 'OP')
              .appendField(new Blockly.FieldDropdown([
                [Blockly.Msg['C_INCREMENT_POS_POSTFIX'] || '後置', 'postfix'],
                [Blockly.Msg['C_INCREMENT_POS_PREFIX'] || '前置', 'prefix'],
              ]) as Blockly.Field, 'POSITION')
          }
          this.setInputsInline(true)
          if (savedName) this.setFieldValue(savedName, 'NAME')
          if (savedOp) this.setFieldValue(savedOp, 'OP')
          if (savedPos) this.setFieldValue(savedPos, 'POSITION')
          if (savedIndex && this.getInput('INDEX')) {
            this.getInput('INDEX')!.connection?.connect(savedIndex.outputConnection)
          }
        },
        saveExtraState: function (this: any) {
          if (!this.hasIndex_) return {}
          return { hasIndex: true }
        },
        loadExtraState: function (this: any, state: { hasIndex?: boolean }) {
          const needIndex = !!state?.hasIndex
          if (needIndex !== this.hasIndex_) {
            this.hasIndex_ = needIndex
            this.buildInputs_()
          }
        },
      }
    }

    // cpp_var_assign_compound_expression
    {
      Blockly.Blocks['cpp_var_assign_compound_expression'] = {
        hasIndex_: false,
        init: function (this: any) {
          this.hasIndex_ = false
          this.buildInputs_()
          this.setOutput(true, 'Expression')
          this.setColour(CATEGORY_COLORS.operators)
          this.setTooltip(Blockly.Msg['C_COMPOUND_ASSIGN_TOOLTIP'] || '複合賦值（運算式）')
        },
        buildInputs_: function (this: any) {
          const savedName = this.getField('NAME') ? this.getFieldValue('NAME') : null
          const savedOp = this.getField('OP') ? this.getFieldValue('OP') : null
          const savedIndex = this.getInput('INDEX') ? this.getInputTargetBlock('INDEX') : null
          const savedValue = this.getInput(C_COMPOUND_ASSIGN_EXPR_INPUTS.value[0]) ? this.getInputTargetBlock('VALUE') : null
          if (this.getInput('INDEX')) this.removeInput('INDEX', true)
          if (this.getInput('INDEX_LABEL')) this.removeInput('INDEX_LABEL')
          if (this.getInput(C_COMPOUND_ASSIGN_EXPR_INPUTS.value[0])) this.removeInput('VALUE', true)

          if (this.hasIndex_) {
            this.appendValueInput('INDEX')
              .setCheck('Expression')
              .appendField(new Blockly.FieldDropdown(() => self.getWorkspaceVarOptions()) as Blockly.Field, 'NAME')
              .appendField('[')
            this.appendValueInput(C_COMPOUND_ASSIGN_EXPR_INPUTS.value[0])
              .setCheck('Expression')
              .appendField(']')
              .appendField(new Blockly.FieldDropdown([
                ['+=', '+='],
                ['-=', '-='],
                ['*=', '*='],
                ['/=', '/='],
                ['%=', '%='],
              ]) as Blockly.Field, 'OP')
          } else {
            this.appendValueInput(C_COMPOUND_ASSIGN_EXPR_INPUTS.value[0])
              .setCheck('Expression')
              .appendField(new Blockly.FieldDropdown(() => self.getWorkspaceVarOptions()) as Blockly.Field, 'NAME')
              .appendField(new Blockly.FieldDropdown([
                ['+=', '+='],
                ['-=', '-='],
                ['*=', '*='],
                ['/=', '/='],
                ['%=', '%='],
              ]) as Blockly.Field, 'OP')
          }
          this.setInputsInline(true)
          if (savedName) this.setFieldValue(savedName, 'NAME')
          if (savedOp) this.setFieldValue(savedOp, 'OP')
          if (savedIndex && this.getInput('INDEX')) {
            this.getInput('INDEX')!.connection?.connect(savedIndex.outputConnection)
          }
          if (savedValue && this.getInput(C_COMPOUND_ASSIGN_EXPR_INPUTS.value[0])) {
            this.getInput(C_COMPOUND_ASSIGN_EXPR_INPUTS.value[0])!.connection?.connect(savedValue.outputConnection)
          }
        },
        saveExtraState: function (this: any) {
          if (!this.hasIndex_) return {}
          return { hasIndex: true }
        },
        loadExtraState: function (this: any, state: { hasIndex?: boolean }) {
          const needIndex = !!state?.hasIndex
          if (needIndex !== this.hasIndex_) {
            this.hasIndex_ = needIndex
            this.buildInputs_()
          }
        },
      }
    }

    // cpp_input_expression
    {
      Blockly.Blocks['cpp_input_expression'] = {
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
          setFieldSafely(this, 'SEL_0', 'x')
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
          setFieldSafely(this, `SEL_${idx}`, 'v' + idx)
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
          const args: ArgSlotState[] = []
          for (let i = 0; i < this.argCount_; i++) {
            const slot = this.argSlots_[i]
            if (slot.mode === 'select') {
              const val = this.getFieldValue(`SEL_${i}`)
              args.push({ mode: 'select', text: val ?? slot.selectedVar ?? 'x' })
            } else if (slot.mode === 'custom') {
              args.push({ mode: 'custom', text: this.getFieldValue(`TEXT_${i}`) ?? '' })
            } else {
              args.push({ mode: 'compose' })
            }
          }
          return { args }
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
              setFieldSafely(this, `SEL_${j}`, slot.text ?? slot.selectedVar)
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

    // cpp_input_formatted_expression
    {
      Blockly.Blocks['cpp_input_formatted_expression'] = {
        argCount_: 1,
        argSlots_: [{ mode: 'select' }] as ArgSlotState[],
        init: function (this: any) {
          this.argCount_ = 1
          this.argSlots_ = [{ mode: 'select', selectedVar: 'x' }]
          this.appendDummyInput('FORMAT_ROW')
            .appendField(Blockly.Msg['C_SCANF_EXPR_LABEL'] || '格式化輸入 (scanf)')
            .appendField(new Blockly.FieldTextInput('%d') as Blockly.Field, 'FORMAT')
          buildArgSlot(this, 0, 'select', {
            getVarOptions: () => self.getScanfVarOptions(),
            inputPrefix: ',',
            separator: ',',
            defaultVar: 'x',
          })
          setFieldSafely(this, 'SEL_0', 'x')
          this.appendDummyInput('TAIL')
            .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plus_()))
            .appendField(new Blockly.FieldImage(MINUS_DISABLED_IMG, 20, 20, '-', () => this.minus_()), 'MINUS_BTN')
          this.setInputsInline(true)
          this.setOutput(true, 'Expression')
          this.setColour(CATEGORY_COLORS.io)
          this.setTooltip(Blockly.Msg['C_SCANF_EXPR_TOOLTIP'] || '格式化讀取輸入（運算式版本）')
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
          setFieldSafely(this, `SEL_${idx}`, 'x')
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
              setFieldSafely(this, `SEL_${i}`, a.text)
            }
          }
          setMinusState(this, this.argCount_ <= 0)
        },
      }
    }

    // cpp_var_declare_expression
    {
      Blockly.Blocks['cpp_var_declare_expression'] = {
        init: function (this: Blockly.Block) {
          this.appendValueInput(C_VAR_DECLARE_EXPR_INPUTS.value[0])
            .setCheck('Expression')
            .appendField(self.createOpenDropdown(() => getTypeOptions()) as Blockly.Field, 'TYPE')
            .appendField(new Blockly.FieldTextInput('i') as Blockly.Field, 'NAME_0')
            .appendField('=')
          this.setInputsInline(true)
          this.setOutput(true, 'Expression')
          this.setColour(CATEGORY_COLORS.data)
          this.setTooltip(Blockly.Msg['U_VAR_DECLARE_EXPR_TOOLTIP'] || '宣告變數（運算式版本）')
        },
      }
    }
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }
}
