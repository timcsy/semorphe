import { allVariableDropdownBlocks } from '../core/variable-dropdown-blocks'
import { allBoardConstantDropdowns, boardConstantOptions } from '../core/board-constant-dropdown-blocks'
import type { BoardPinModel } from '../core/types'
import { componentsDeclaringVariableType } from '../core/language-executors'
import * as Blockly from 'blockly'
import { FieldMultilineInput } from '@blockly/field-multilineinput'
import type { BlockSpecRegistry } from '../core/block-spec-registry'
import { CATEGORY_COLORS, DEGRADATION_VISUALS } from './theme/category-colors'
import { attachBranchList } from './branch-list-block'
import { attachParamList, registerParamMutatorBlocks, MUTATOR_CONTAINER } from './param-list-block'
import { preserveForeignExtraState } from './foreign-extra-state'
import { defineVariadicBlock, attachVariadic } from './variadic-block'
import { declareDropdownSource, registerDynamicDropdownField } from './dynamic-dropdown-field'
import { componentsDeclaringVariables } from '../core/component/traits'
import { deriveBlockType } from '../core/component/derive-block-type'
import { abstractComponentOf } from '../core/language-executors'
import { setFieldSafely } from './field-write'
import { isPlainDeclaration } from '../core/component/traits'
// 🔴 **不再 import 語言套件**（spec 153）——三個 C 專屬的 input 名由組裝點注入。
//
// ⚠️ 而「把它們搬進 `core/block-input-names`」是**錯的修法**：
//    那個檔已經硬編了 9 個 `cpp_*` 積木型別，搬過去會讓
//    中立性護欄的**第一維降、第二維升**——把搬家當成清償。
//    （第二維就是 spec 153 為此加的。）
type InputNames = { value: string[]; statement: string[] }

// 🔴 **十二個插槽名全部由組裝點注入**（spec 153 三個 → spec 154 十二個）。
//    其中九個原本住在 `core/block-input-names.ts`——而那是**位置錯**：
//    它們一個一個都是 `cpp_*`，唯一的消費者就是這個檔。
//
// 🔴 **這些初始值不是「預設」，是【還沒注入】的佔位**。
//    ⚠️ 一個看起來合理的預設值，會讓「組裝點漏了」與「值本來就是這樣」
//    長得一模一樣——而那是這個專案的**靜默降級反模式**。
//    🟢 所以 `registerAll` 會在沒注入時**當場拋錯**，不是默默用佔位值。
let C_COMPOUND_ASSIGN_EXPR_INPUTS: InputNames = { value: ['VALUE'], statement: [] }
let C_VAR_DECLARE_EXPR_INPUTS: InputNames = { value: ['INIT_0'], statement: [] }
let IF_INPUTS: InputNames = { value: ['CONDITION'], statement: ['THEN', 'ELSE'] }
let FUNDEF_INPUTS: InputNames = { value: [], statement: ['BODY'] }
// eslint-disable-next-line @typescript-eslint/no-unused-vars


let inputNamesInjected = false

/** 組裝點推進來（`app.ts`）。⚠️ 必須在 `registerAll` 之前。 */
/**
 * 🪦 **`arrayAccess`（163）·`returnBlock`（164）·`whileBlock`／`countLoop`／`arrayAssign`／`varAssign`（165）·`compoundAssign`（166）已從契約移除**——它的唯一消費者
 * （`cpp_array_at` 的命令式定義）退場了。
 *
 * ⚠️ **一個沒有消費者的注入欄位，會讓組裝點以為它還要提供那份資料**
 * ——而那份資料從此沒有人驗，錯了也不會有人知道。
 */
export function setLanguageInputNames(names: {
  compoundAssignExpr: InputNames
  varDeclareExpr: InputNames
  ifBlock: InputNames
  funcDef: InputNames
}): void {
  C_COMPOUND_ASSIGN_EXPR_INPUTS = names.compoundAssignExpr
  C_VAR_DECLARE_EXPR_INPUTS = names.varDeclareExpr
  IF_INPUTS = names.ifBlock
  FUNDEF_INPUTS = names.funcDef
  inputNamesInjected = true
}

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
    // 🔴 **沒注入就出聲**——見上面那段的理由。
    if (!inputNamesInjected) {
      throw new Error(
        'BlockRegistrar：語言的插槽名還沒注入。組裝點要先呼叫 `setLanguageInputNames(...)`'
        + '——⚠️ 沒有它的話積木會用佔位的插槽名建起來，而那個錯只會在序列化時浮現。',
      )
    }
    this.accessors = accessors
    // 🔴 **先註冊欄位型別與選項來源，再建積木**——`jsonInit` 遇到
    // `field_dynamic_dropdown` 時要查得到它，否則那顆積木**整個建不起來**。
    registerDynamicDropdownField()
    declareDropdownSource('names', () => this.getNameRefOptions())
    declareDropdownSource('vars', () => this.getWorkspaceVarOptions())
    declareDropdownSource('funcs', () => this.getWorkspaceFuncOptions())
    declareDropdownSource('arrays', () => this.getWorkspaceArrayOptions())
    this.registerBlocksFromSpecs()
  }

  // ─── Workspace option helpers (used by dynamic block dropdowns + app.ts) ───

  /**
   * **一個名字的參照可以填什麼**——工作區的變數 ∪ 目前這塊板子的具名常數。
   *
   * ## 🔴 為什麼不是直接改 `getWorkspaceVarOptions()`
   *
   * 那一支有**十個呼叫端**，而只有 `cpp_var_ref` 是**讀**；
   * 其餘九個是**寫入目標**（`cpp_var_assign`、遞增、複合指定），
   * 加了常數之後學生選得到 `HIGH = 5`。
   *
   * > **兩個下拉長得一樣，不代表它們問的是同一個問題。**
   *
   * ## 而它為什麼該有兩段
   *
   * 執行期解析一個裸名字的順序是（`var_ref/execute.ts`）：
   * **宣告的變數 → 串流 → 環境提供的具名常數**。
   * 而下拉今天只畫得出第一段——於是學生貼上 `pinMode(D1, OUTPUT)` 之後
   * 點開 `D1`，看到的是工作區裡根本沒有的 `x`。
   *
   * 🔴 **變數在前，而同名時變數贏**——「一個名字的意思由誰宣告它決定」。
   *
   * ⚠️ **串流（`cout`）與套件常數（`DHT11`／`WL_*`）不在這裡**：
   * 前者不是值，後者不隨板子變（spec 149 明確排除）。
   */
  getNameRefOptions(): Array<[string, string]> {
    const options = this.getWorkspaceVarOptions()
    const names = boardConstantOptions(this.currentBoard?.())
    if (!names) return options
    const seen = new Set(options.map((o) => o[1]))
    for (const n of names) if (!seen.has(n)) options.push([n, n])
    return options
  }

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

      // 🔴 **第一條路：問宣告**（spec 172）。
      //
      // 下面那一長串是**寫死的積木型別**，於是第二個語言的變數一個都進不了下拉
      // ——使用者 2026-08-21 回報：「那邊的積木選擇無法選到前面已經有的變數」。
      //
      // > **一份「哪些積木會產生名字」的清單，如果寫在介面層，
      // > 那麼「這個語言有沒有變數」就變成介面層要知道的事。**
      //
      // ⚠️ 而下面那一段**沒有動**——它是 vision 記著的那批命令式定義的一部分，
      // 改它要走比對護欄。這裡加的是**第二條路**，兩條並存到那批退場為止。
      const declared = new Map(
        componentsDeclaringVariables().map((c) => [deriveBlockType(c.componentId), c.fields]),
      )
      for (const block of blocks) {
        const fields = declared.get(block.type)
        if (!fields) continue
        for (const pattern of fields) {
          if (pattern.includes('{i}')) {
            for (let i = 0; ; i++) {
              const v = block.getFieldValue(pattern.replace('{i}', String(i)))
              if (v === null || v === undefined) break
              addOption(v)
            }
          } else {
            const v = block.getFieldValue(pattern)
            if (v !== null && v !== undefined) addOption(v)
          }
        }
      }

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
        } else if (isPlainDeclaration(abstractComponentOf(this.componentIdOfBlockType(block.type) ?? '') ?? '')) {
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
   * （`components.json` 的 `declaresVariableType`）。同一個宣告也餵給同步
   * 控制器的降級——一個事實，兩個消費者。
   */
  /**
   * 積木型別 → 概念身分（`cpp_pin_attach` → `cpp:pin_attach`）。
   *
   * 🔴 **spec 149 修的那個 bug 就是少了這一步。**
   * `getWorkspaceVarOptions()` 原本寫著
   * `isPlainDeclaration(abstractComponentOf(block.type))`
   * ——而 `abstractComponentOf` 的鍵是**概念身分**（冒號），
   * `block.type` 是**導出的積木型別**（底線）。於是那個分支**永遠是 false**，
   * **24 顆宣告元件一顆都沒進下拉**（`vector`／`string`／`pin_attach`…）。
   *
   * > **兩個字串都長得像識別字，而它們是兩個命名空間
   * > ——型別系統擋不住，因為兩邊都是 `string`。**
   *
   * ⚠️ 而它靜默了很久：查不到只會讓下拉少幾個名字，**不會拋錯**。
   */
  private componentIdOfBlockType(blockType: string): string | undefined {
    if (!this.blockTypeToComponent) {
      this.blockTypeToComponent = new Map()
      for (const spec of this.blockSpecRegistry.getAll()) {
        const t = (spec.blockDef as { type?: string } | undefined)?.type
        const cid = spec.componentMapping?.componentId
        if (t && cid) this.blockTypeToComponent.set(t, cid)
      }
    }
    return this.blockTypeToComponent.get(blockType)
  }

  private blockTypeToComponent?: Map<string, string>

  private blockTypesDeclaringVariableType(type: string): Set<string> {
    const componentIds = new Set(componentsDeclaringVariableType(type))
    const types = new Set<string>()
    for (const spec of this.blockSpecRegistry.getAll()) {
      const cid = spec.componentMapping?.componentId
      const blockType = (spec.blockDef as { type?: string } | undefined)?.type
      if (cid && componentIds.has(cid) && blockType) types.add(blockType)
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

  /** 目前這塊板子——⚠️ **提供者模式**，與 `execution-controller` 的 `currentBoard` 同一個形狀。 */
  private currentBoard?: () => BoardPinModel | undefined

  /** 由 `app.ts` 接上。沒接 ＝ 沒有板子 ＝ 下拉維持宣告裡那份。 */
  setBoardProvider(provider: () => BoardPinModel | undefined): void {
    this.currentBoard = provider
  }

  /**
   * 讓一個**已經由 JSON 建好**的下拉，改成問目前這塊板子。
   *
   * 🔴 **原本那份選項留著當「沒有板子」的答案**——不是備援，是**另一種目標的真相**
   * （`cpp`／`c`／競程／不指定板子的 `arduino`）。所以這裡**不複製**它。
   *
   * ⚠️ 而選項是**惰性**的（開的時候才算），所以**換目標不必重註冊積木**。
   */
  private bindBoardConstantDropdown(block: Blockly.Block, fieldName: string): void {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const field = block.getField(fieldName) as any
    if (!field) return
    const declared = field.menuGenerator_
    const self = this
    field.menuGenerator_ = function () {
      const names = boardConstantOptions(self.currentBoard?.())
      if (!names) return typeof declared === 'function' ? declared.call(this) : declared
      return names.map((n) => [n, n])
    }
    // 🔴 **不認得的值要留著**——學生在 Uno 下放了 `A6`，切到 C3 之後
    //    那顆積木【仍然是 A6】。一個會把它不認得的值換掉的下拉，
    //    等於在使用者沒看的時候改掉他的程式。
    field.doClassValidation_ = function (this: any, newValue: string) {
      if (newValue === null || newValue === undefined) return null
      const options = this.getOptions(false)
      if (!options.some((o: string[]) => o[1] === newValue)) options.push([newValue, newValue])
      return newValue
    }
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }

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
    const self = this
    const specs = this.blockSpecRegistry.getAll()
    for (const spec of specs) {
      const blockDef = spec.blockDef
      const blockType = blockDef?.type as string | undefined
      if (!blockType) continue
      if (Blockly.Blocks[blockType]) continue

      // 🔴 **宣告了可變參數的，走宣告式的建構器**（spec 162）。
      //
      // `renderMapping.dynamicRules` **早就宣告在膠囊裡**（16 顆），而讀它的
      // 只有投影那一半。積木型別的**定義**那一半一直是命令式的
      // ——一顆一段、只認 `cpp_*`，於是第二個語言的第一顆積木在瀏覽器報
      // `missing a(n) EXPR0 connection`：**宣告有了，沒有人照著它建那些 input**。
      //
      // ⚠️ 只吃**單一插槽序列**的那種（`EXPR{i}`）。每項一組多個欄位的
      // （`cpp_func_def` 的 `TYPE_{i}`＋`PARAM_{i}`）是同一個宣告的另一種形狀，
      // 不在這一版——**一次只還一種形狀**。
      // 🔴 **顯式選入，不從 `dynamicRules` 推論。**
      //
      // ⚠️ 第一版的判準是「有單一 `inputPattern` 且沒有 `message0`」，而它**太鬆**：
      // `cpp_vector_declare` 也符合，然而它的 init 還有型別下拉與名稱欄位
      // ——宣告式建構器會**把它們全部弄丟**，而**沒有任何測試在看標籤與欄位**
      // （工具箱快照只比 id 與順序）。
      //
      // > **「符合這個形狀」不等於「只有這個形狀」。**
      //
      // 🟢 所以要顯式：`blockDef.builder === 'variadic'` 才接管。
      // 一顆一顆選入，而每一顆選入時都要開瀏覽器看它長對了沒。
      const rules = (spec.renderMapping as { dynamicRules?: { inputPattern?: string; childSlot?: string }[] } | undefined)?.dynamicRules
      const soleRule = rules?.length === 1 ? rules[0] : undefined
      // 🔴 **第二種形狀：可增減的【欄位組】**（spec 169）——`def f(a, b)` 的參數列。
      //
      // 與上面那種的差別是「加減的是什麼」：那種加減值插槽，這種加減欄位組。
      // 而它**不建整顆積木**：`jsonInit` 先建靜態的部分（標籤、名字欄位、函式體），
      // 這裡再把動態的那一段接上去。
      //
      // > **一個「從零建整顆」的建構子，遇到「只有一部分是動態的」積木時，
      // > 唯一的出路是把靜態的部分也吞進去——而那正是它會弄丟欄位的原因。**
      // 🔴 **第三種形狀：可增減的【成對插槽】＋ 一個可有可無的尾巴**（spec 169）
      //    —— `if / elif… / else`。使用者：「if-else 還沒有 mutation」。
      const branchSpec = (blockDef as { branchList?: Record<string, unknown> }).branchList
      if (branchSpec) {
        Blockly.Blocks[blockType] = { init: function (this: Blockly.Block) { this.jsonInit(blockDef as never) } }
        attachBranchList(blockType, branchSpec as unknown as Parameters<typeof attachBranchList>[1])
        continue
      }

      const paramSpec = (blockDef as { paramList?: Record<string, unknown> }).paramList
      if (paramSpec) {
        Blockly.Blocks[blockType] = { init: function (this: Blockly.Block) { this.jsonInit(blockDef as never) } }
        attachParamList(blockType, paramSpec as unknown as Parameters<typeof attachParamList>[1])
        continue
      }
      if (soleRule?.inputPattern && (blockDef as { builder?: string }).builder === 'variadic') {
        const bd = blockDef as unknown as Record<string, unknown>
        // 🔴 **宣告裡有靜態的部分時，用「接上去」而不是「從零建」**（2026-08-22）。
        //
        // 從零建的那一種表達不了「插槽在前」的形狀（`對 [接收者] 做 [方法名] (引數…)`），
        // 而它把 `args0` 裡的每一格**都丟掉**——症狀是瀏覽器載入積木狀態時
        // `MissingConnection: … is missing a(n) OBJ connection`，
        // 整個工作區載不進去。而 `METHOD` 被丟掉時連錯都不報。
        //
        // ⚠️ 判準是**宣告裡有沒有靜態的部分**，不是這顆積木叫什麼。
        const spec = {
          inputPattern: soleRule.inputPattern,
          check: (bd.slotCheck as string) ?? 'Expression',
          colour: (bd.colour as string) ?? '#5CB1D6',
          inputsInline: bd.inputsInline as boolean | undefined,
          previousStatement: bd.previousStatement as string | undefined,
          nextStatement: bd.nextStatement as string | undefined,
          output: bd.output as string | undefined,
          minCount: bd.minCount as number | undefined,
        }
        if (Array.isArray(bd.args0) && bd.args0.length > 0) {
          Blockly.Blocks[blockType] = { init: function (this: Blockly.Block) { this.jsonInit(blockDef as never) } }
          attachVariadic(blockType, spec)
          continue
        }
        defineVariadicBlock(blockType, {
          inputPattern: soleRule.inputPattern,
          labelKey: (bd.labelKey as string) ?? undefined,
          labelFallback: (bd.labelFallback as string) ?? undefined,
          check: (bd.slotCheck as string) ?? 'Expression',
          colour: (bd.colour as string) ?? '#5CB1D6',
          tooltipKey: typeof bd.tooltip === 'string' && bd.tooltip.startsWith('%{BKY_')
            ? bd.tooltip.slice(6, -1) : undefined,
          tooltipFallback: typeof bd.tooltip === 'string' && !bd.tooltip.startsWith('%{BKY_')
            ? bd.tooltip : undefined,
          inputsInline: bd.inputsInline as boolean | undefined,
          previousStatement: bd.previousStatement as string | undefined,
          nextStatement: bd.nextStatement as string | undefined,
          output: bd.output as string | undefined,
          leadingField: bd.leadingField as { type: string; name: string } | undefined,
          minCount: bd.minCount as number | undefined,
        })
        continue
      }

      // 🔴 **JSON 的 `field_dropdown` 會【靜默丟掉】不在清單裡的值**（spec 150 實測）：
      //    學生貼 `#include <WiFi.h>`，而 `cpp_include` 的清單只有 20 個標頭
      //    ——Blockly 把它換成第一項 `stdio.h`，**而沒有任何訊息**。
      //
      // > **一個會把它不認得的值換掉的下拉，等於在使用者沒看的時候改掉他的程式。**
      //
      // 🟢 `createOpenDropdown` 早就有正解（不認得就把值加進選項），
      //    而它原本只有命令式註冊的那幾顆在用。這裡讓**所有 JSON 下拉**都拿到。
      const preserveUnknown = (block: Blockly.Block) => {
        for (const input of block.inputList) {
          for (const field of input.fieldRow) {
            /* eslint-disable @typescript-eslint/no-explicit-any */
            const f = field as any
            if (!f.menuGenerator_ || typeof f.doClassValidation_ !== 'function') continue
            f.doClassValidation_ = function (this: any, newValue: string) {
              if (newValue === null || newValue === undefined) return null
              const options = this.getOptions(false)
              if (!options.some((o: string[]) => o[1] === newValue)) options.push([newValue, newValue])
              return newValue
            }
          }
        }
      }

      const boardFields = allBoardConstantDropdowns()
        .filter((d) => d.blockType === blockType)
        .map((d) => d.field)

      Blockly.Blocks[blockType] = {
        init: function (this: Blockly.Block) {
          this.jsonInit(blockDef)
          // 🔴 **不認得的值要留著，不得靜默換掉**（spec 150）
          preserveUnknown(this)
          // 🔴 **腳位常數的下拉列的是【目前這塊板子】的常數**（spec 148）
          //    ——名單由語言套件宣告，這一層不認識任何具體的目標名字。
          for (const field of boardFields) self.bindBoardConstantDropdown(this, field)
        },
      }
    }

    this.registerDynamicBlocks()

    // 🔴 **最後一步：讓每一顆有自訂 `extraState` 的積木留住別人的鍵**（2026-08-23）。
    //    渲染那一路把**標註**（行末註解）放在 `extraState` 裡，而那些積木的
    //    `loadExtraState` 只讀自己那幾個鍵——症狀是**使用者打的註解在
    //    「積木→程式碼」之後不見了**。見那個模組的檔頭。
    //    ⚠️ 放在這裡而不是每一顆各自處理：**一條規則只寫一次**，
    //    而往後新增的 mutation 積木自動涵蓋。
    for (const type of Object.keys(Blockly.Blocks)) preserveForeignExtraState(Blockly.Blocks[type])
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

    // 🪦 **`cpp_literal_string` 的命令式定義已於 spec 163 刪除。**
    //    比對護欄（`audit-block-def-parity`）證明**兩份定義建出來的形狀一模一樣**
    //    ——插槽、欄位、output、statement、顏色逐項比過，才刪。

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
          // 🔴 **這三格是宣告裡一直都有的**（`renderMapping.inputs`），而命令式的
          //    init **從來沒有建出來**——於是 `vector<int> v(5, 0)` 投影出來的
          //    積木狀態指向不存在的插槽，**整個工作區載入失敗**（紅色橫幅，
          //    2026-08-23 由第五十一條護欄的 C++ 那一維抓到）。
          //    ⚠️ 與 `cpp_array_declare` 的 `SIZE` 同一個做法：**固定存在、留空即無**。
          //    > **宣告式的對映表與命令式的 init 是同一顆積木的兩份真相。**
          this.appendValueInput('SIZE')
            .setCheck('Expression')
            .appendField(Blockly.Msg['CPP_VECTOR_DECLARE_SIZE'] || '大小')
          this.appendValueInput('FILL')
            .setCheck('Expression')
            .appendField(Blockly.Msg['CPP_VECTOR_DECLARE_FILL'] || '每格填')
          this.appendValueInput('SOURCE')
            .setCheck('Expression')
            .appendField(Blockly.Msg['CPP_VECTOR_DECLARE_SOURCE'] || '複製自')
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
          this.setColour(CATEGORY_COLORS.containers)
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

    // 🪦 **`cpp_print` 的命令式定義已於 spec 162 刪除**——它改由
    //    `variadic-block.ts` 依膠囊的 `builder: "variadic"` ＋ `dynamicRules` 建。
    //    ⚠️ 刪掉而不是留著：`registerBlocksFromSpecs` 先跑，留著的那段
    //    **永遠不會被執行**，而死碼與活碼在中立性報表上一樣算一筆。

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

    // 🪦 **`cpp_endl` 的命令式定義已於 spec 163 刪除。**
    //    比對護欄（`audit-block-def-parity`）證明**兩份定義建出來的形狀一模一樣**
    //    ——插槽、欄位、output、statement、顏色逐項比過，才刪。

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

    // 🪦 **`cpp_loop_while` 的命令式定義已於 spec 165 刪除**（比對護欄確認一模一樣）。
    //    ⚠️ **用語改成宣告的「持續執行」**（人拍板 2026-08-20）：與它自己的 tooltip 一致，
    //    而「重複」和 `for` 的「重複」撞名，學生分不出兩個迴圈。

    // 🪦 **`cpp_loop_count` 的命令式定義已於 spec 165 刪除**（比對護欄確認一模一樣）。
    //    ⚠️ 宣告的下拉本來寫死英文（已修），且少了「重複」那個語句標籤（已補）。

    // cpp_break, cpp_continue
    // 🪦 **`cpp_break` 的命令式定義已於 spec 164 刪除。**
    //    ⚠️ 而刪之前先**修了宣告**：它多了 `nextStatement`，
    //    而 `cpp_break` 之後接東西是**不可達的程式碼**——命令式那份才是對的。
    //    比對護欄確認兩份一模一樣之後才刪。
    // 🪦 **`cpp_continue` 的命令式定義已於 spec 163 刪除。**
    //    比對護欄（`audit-block-def-parity`）證明**兩份定義建出來的形狀一模一樣**
    //    ——插槽、欄位、output、statement、顏色逐項比過，才刪。

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

      // 🔴 **齒輪要在原本的 `init` 之後掛上**——這個工廠是在積木定義好之後
      //    才接上去的，所以包一層。⚠️ 只有帶名字欄位的那些才有預設值可談。
      if (config.withNameField) {
        const baseParamInit = target.init
        target.init = function (this: any): void {
          baseParamInit.call(this)
          this.setMutator(new Blockly.icons.MutatorIcon(
            [registerParamMutatorBlocks([{
              key: 'default',
              labelKey: 'U_FUNC_DEF_PARAM_DEFAULT_LABEL',
              labelFallback: '預設值',
            }])],
            this as Blockly.BlockSvg,
          ))
        }
      }

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
          // 🔴 **預設值那一格**（2026-08-23）：抬升與產生都收 `int b = 10`，
          //    而積木上沒有那一格——於是「程式碼→積木→程式碼」把 `= 10` 吃掉，
          //    而 `f(1)` 從此少一個引數。與另一個語言那顆函式定義的型別註記同一個形狀。
          //    ⚠️ 這一行**不准提到那個語言的名字**——這個檔有一條護欄在看（P3）。
          //    ⚠️ **留空 ＝ 沒有預設值**，不是「還沒填」。
          //
          // 🔴 **它住在自己的 input，而且預設是收起來的**：
          //    固定長在那裡的話，沒有預設值的參數後面會掛著一個
          //    `＝` 加一個空框——那個空框什麼都沒說（使用者回報）。
          //    ⚠️ 用 `input.setVisible`（公開 API）而不是 `field.setVisible`
          //    （後者標著 `@internal`，而且不會重新排版）。
          // 🔴 **開關在齒輪上，不在每一格**（2026-08-23，使用者提的）：
          //    這個 repo 的既有分工是「**齒輪管形狀，`＋`／`−` 管數量**」
          //    ——與同族的變數宣告那顆一致。每一格塞一個小圖示的話，
          //    三個參數就有三個圖示排在那裡，而它們說的是同一件事。
          const defInput = this.appendDummyInput(`PARAM_DEF_${idx}`)
          defInput.appendField('＝')
          defInput.appendField(
            // ⚠️ **驗證器不是為了驗證**：它是「值被設進來」的唯一通知，
            //    而存檔還原時 Blockly 正是這樣把預設值放回去的
            //    ——少了它，載回來的積木會把 `= 10` 藏起來。
            new Blockly.FieldTextInput('', (v: string) => {
              if (v) queueMicrotask(() => this.showDefault_(idx, true))
              return v
            }) as Blockly.Field,
            `PARAM_DEFAULT_${idx}`,
          )
          defInput.setVisible(false)
        }
        this.moveInputBefore(`PARAM_${idx}`, 'PARAMS_END')
        if (this.getInput(`PARAM_DEF_${idx}`)) this.moveInputBefore(`PARAM_DEF_${idx}`, 'PARAMS_END')
        this.paramCount_++
        if (this.paramCount_ === 1) this.rebuildParamLabels_()
        setMinusState(this, false)
      }

      /** 把某一格的預設值欄位打開或收起來（收起來時**一併清掉值**）。 */
      target.showDefault_ = function (this: any, idx: number, show: boolean): void {
        const input = this.getInput(`PARAM_DEF_${idx}`)
        if (!input || input.isVisible() === show) return
        if (!show) this.getField(`PARAM_DEFAULT_${idx}`)?.setValue('')
        input.setVisible(show)
        // ⚠️ 這一步是必要的：`setVisible` 只改狀態，畫面要自己叫它重排
        this.queueRender?.()
      }

      // ── 齒輪：一個參數一顆小積木，勾選格說它有沒有預設值 ──────────
      //    ⚠️ 小積木的型別由**勾選格的組合**決定（見那個工廠的檔頭）
      //    ——這裡只有「預設值」一格，而另一個語言那顆有兩格。
      const gearGroups = [{
        key: 'default',
        labelKey: 'U_FUNC_DEF_PARAM_DEFAULT_LABEL',
        labelFallback: '預設值',
      }]

      target.decompose = function (this: any, workspace: Blockly.WorkspaceSvg): Blockly.Block {
        const container = workspace.newBlock(MUTATOR_CONTAINER)
        ;(container as Blockly.BlockSvg).initSvg()
        let connection = container.getInput('STACK')!.connection!
        for (let i = 0; i < this.paramCount_; i++) {
          const item = workspace.newBlock(registerParamMutatorBlocks(gearGroups))
          ;(item as Blockly.BlockSvg).initSvg()
          item.setFieldValue(String(this.getFieldValue(`PARAM_${i}`) ?? `#${i + 1}`), 'PL_NAME')
          item.setFieldValue(this.getInput(`PARAM_DEF_${i}`)?.isVisible() ? 'TRUE' : 'FALSE', 'OPT_default')
          connection.connect(item.previousConnection!)
          connection = item.nextConnection!
        }
        return container
      }

      target.compose = function (this: any, container: Blockly.Block): void {
        const wants: boolean[] = []
        let item = container.getInputTargetBlock('STACK')
        while (item) {
          wants.push(item.getFieldValue('OPT_default') === 'TRUE')
          item = item.getNextBlock()
        }
        // ⚠️ **先對齊數量再對齊形狀**——反過來的話，多出來的那幾格還不存在
        while (this.paramCount_ < wants.length) this.plusParam_()
        while (this.paramCount_ > wants.length) this.minusParam_()
        for (let i = 0; i < wants.length; i++) this.showDefault_(i, wants[i])
        setMinusState(this, this.paramCount_ <= 0)
      }

      target.minusParam_ = function (this: any): void {
        if (this.paramCount_ <= 0) return
        this.paramCount_--
        this.removeInput(`PARAM_${this.paramCount_}`)
        // ⚠️ 預設值那一格是**另一個 input**——少刪它的話，
        //    下一次 `＋` 會撞到一個已經存在的名字（Blockly 會丟錯）。
        if (this.getInput(`PARAM_DEF_${this.paramCount_}`)) this.removeInput(`PARAM_DEF_${this.paramCount_}`)
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

    // cpp_method_call / cpp_method_call_expression
    //
    // 🔴 **它們原本【沒有】動態引數插槽，而症狀是引數安靜地不見。**
    //
    // 2026-08-18 使用者在 Arduino IDE 實測到：`Serial.write(cmd)` 的積木上
    // 是「對 Serial 執行 write（ ▯ ）」——**括號裡是空的**。
    //
    // ⚠️ 而語義樹是對的（`children.args` 有那顆 `cmd`）、產生器也是對的
    // （`Serial.write(cmd);`）。壞的只有**投影**那一側：
    // `renderMapping` 把 `ARGS` 當成一個**欄位**對到 `args` 這個**接點**
    // ——而接點是節點陣列，一個文字欄位裝不下它。
    //
    // > **一個只在投影那一側丟資料的 bug，
    // > lift 與 generate 各自的測試都看不到它。**
    //
    // 🔴 而修 `renderMapping` 只做完一半：這裡**沒有** `ARG_{i}` 這個輸入，
    // 於是產出的 `ARG_0` 沒有插槽可接。那正是專案記過的「雙重真相來源」
    // ——`cpp_func_call` 兩邊都有，而 `cpp_method_call` 只有 JSON 那一邊。
    for (const [type, isExpr] of [
      ['cpp_method_call', false],
      ['cpp_method_call_expression', true],
    ] as [string, boolean][]) {
      const msgKey = isExpr ? 'CPP_METHOD_CALL_EXPR' : 'CPP_METHOD_CALL'
      Blockly.Blocks[type] = {
        argCount_: 0,
        init: function (this: any) {
          this.argCount_ = 0
          this.buildHead_()
          this.appendDummyInput('TAIL')
            .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plusArg_()))
            .appendField(new Blockly.FieldImage(MINUS_DISABLED_IMG, 20, 20, '-', () => this.minusArg_()), 'MINUS_BTN')
          this.setInputsInline(true)
          if (isExpr) {
            this.setOutput(true, 'Expression')
          } else {
            this.setPreviousStatement(true, 'Statement')
            this.setNextStatement(true, 'Statement')
          }
          // ⚠️ 顏色與 JSON 那一份一致——**兩份定義的差異就是那個病本身**。
          this.setColour('#4C97FF')
          this.setTooltip(Blockly.Msg[`${msgKey}_TOOLTIP`] || '')
        },
        /** 「對 <物件> 執行 <方法>」——⚠️ 欄位值要保住，重建時再塞回去。 */
        buildHead_: function (this: any) {
          const obj = this.getFieldValue('OBJ') ?? 'obj'
          const method = this.getFieldValue('METHOD') ?? 'method'
          if (this.getInput('LABEL')) this.removeInput('LABEL')
          const input = this.appendDummyInput('LABEL')
            .appendField(Blockly.Msg['CPP_METHOD_CALL_ON'] || '對')
            .appendField(new Blockly.FieldTextInput(obj), 'OBJ')
            .appendField(Blockly.Msg['CPP_METHOD_CALL_DO'] || '執行')
            .appendField(new Blockly.FieldTextInput(method), 'METHOD')
          if (this.argCount_ > 0) input.appendField(Blockly.Msg['U_FUNC_CALL_OPEN'] || '（')
        },
        rebuildArgLabels_: function (this: any) {
          if (this.getInput('TAIL')) this.removeInput('TAIL')
          this.buildHead_()
          this.appendDummyInput('TAIL')
          const tail = this.getInput('TAIL')
          if (this.argCount_ > 0) tail.appendField(Blockly.Msg['U_FUNC_CALL_CLOSE'] || '）')
          tail
            .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plusArg_()))
            .appendField(
              new Blockly.FieldImage(
                this.argCount_ > 0 ? MINUS_IMG : MINUS_DISABLED_IMG, 20, 20, '-', () => this.minusArg_(),
              ),
              'MINUS_BTN',
            )
          if (this.argCount_ > 0) this.moveInputBefore('LABEL', 'ARG_0')
        },
        plusArg_: function (this: any) {
          const idx = this.argCount_
          this.appendValueInput(`ARG_${idx}`).appendField(idx > 0 ? ',' : '')
          this.moveInputBefore(`ARG_${idx}`, 'TAIL')
          this.argCount_++
          if (this.argCount_ === 1) this.rebuildArgLabels_()
          setMinusState(this, false)
        },
        minusArg_: function (this: any) {
          if (this.argCount_ <= 0) return
          this.argCount_--
          this.removeInput(`ARG_${this.argCount_}`)
          if (this.argCount_ === 0) this.rebuildArgLabels_()
          setMinusState(this, this.argCount_ <= 0)
        },
        // ⚠️ **與 `cpp_func_call` 的格式必須完全相同**——
        //    `STATEMENT_TO_EXPRESSION` 直接搬移 extraState（專案記過的契約）。
        saveExtraState: function (this: any) {
          if (this.argCount_ > 0) return { argCount: this.argCount_ }
          return null
        },
        loadExtraState: function (this: any, state: { argCount?: number }) {
          const count = state?.argCount ?? 0
          while (this.argCount_ < count) this.plusArg_()
        },
      }
    }
    /* eslint-enable @typescript-eslint/no-explicit-any */

    // 🪦 **`cpp_return` 的命令式定義已於 spec 164 刪除。**
    //    ⚠️ 而刪之前先**修了宣告**：它多了 `nextStatement`，
    //    而 `cpp_return` 之後接東西是**不可達的程式碼**——命令式那份才是對的。
    //    比對護欄確認兩份一模一樣之後才刪。

    // 🪦 **`cpp_var_ref` 的命令式定義已於 spec 164 刪除。**
    //    它的活下拉改由宣告表達（`field_dynamic_dropdown` ＋ `source: "names"`）。

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

    // 🔴 **`cpp_raw_code` 【還不能刪】——比對護欄看不到它真正做的事。**
    //
    // 它的 `loadExtraState` 會依 `degradationCause` **換顏色與 tooltip**
    // （`DEGRADATION_VISUALS`），並在 `unresolved` 時改成特別的提示。
    // 而**宣告只有一個固定的灰色**。
    //
    // ⚠️ 比對護欄比的是「**剛建好的樣子**」——而這段邏輯只在
    // **載入既有積木時**才跑，所以它報「一模一樣」。
    //
    // > **一個只比「剛建好的樣子」的比對，看不到「載入時才長出來的東西」。**
    //
    // 🟢 重開條件：宣告表達得出「依 extraState 換視覺」（那是另一個機制）。
    // cpp_raw_code
    {
      Blockly.Blocks['cpp_raw_code'] = {
        init: function (this: Blockly.Block) {
          this.appendDummyInput()
            .appendField(Blockly.Msg['C_RAW_CODE_LABEL'] || '直接寫程式碼：')
            .appendField(new Blockly.FieldTextInput('') as Blockly.Field, 'CODE')
          this.setPreviousStatement(true, 'Statement')
          this.setNextStatement(true, 'Statement')
          this.setColour(CATEGORY_COLORS.special)
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
            this.setColour(CATEGORY_COLORS.special)
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


    // 🪦 **`cpp_array_at` 的命令式定義已於 spec 163 刪除。**
    //    比對護欄（`audit-block-def-parity`）證明**兩份定義建出來的形狀一模一樣**
    //    ——插槽、欄位、output、statement、顏色逐項比過，才刪。

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

    // 🪦 **`cpp_array_assign` 的命令式定義已於 spec 165 刪除**（比對護欄確認一模一樣）。
    //    ⚠️ 宣告本來是一個**假的下拉**（寫死 `arr` 一個選項，已改成 `field_dynamic_dropdown`）。

    // 🪦 **`cpp_var_assign` 的命令式定義已於 spec 165 刪除**（比對護欄確認一模一樣）。
    //    ⚠️ 宣告本來是靜態 `field_input`，已改成 `field_dynamic_dropdown`。

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

    // 🪦 **`cpp_var_assign_compound` 的命令式定義已於 spec 166 刪除**（比對護欄確認一模一樣）。
    //    ⚠️ 而它的 `hasIndex`（載入時加／移除 `INDEX` 插槽）**宣告表達得出**
    //    （`extraStateFlags`）——那一點是**護欄新增的第五維**證明的，不是我猜的。

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

    // 🪦 **`cpp_comment` 的命令式定義已於 spec 165 刪除**（比對護欄確認一模一樣）。

    // 🪦 **`cpp_block_comment` 的命令式定義已於 spec 165 刪除**（比對護欄確認一模一樣）。

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
