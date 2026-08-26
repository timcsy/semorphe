import { allVariableDropdownBlocks } from '../core/variable-dropdown-blocks'
import { allBoardConstantDropdowns, boardConstantOptions } from '../core/board-constant-dropdown-blocks'
import type { BoardPinModel } from '../core/types'
import { componentsDeclaringVariableType } from '../core/language-executors'
import * as Blockly from 'blockly'
/**
 * 🔴 **這個 import 是一次【註冊】，不是一個用不到的符號。**
 *
 * `@blockly/field-multilineinput` 在被 import 時把自己登記成
 * `field_multilinetext`——而**宣告式的 `blockDef` 靠那個名字找它**。
 *
 * ⚠️ 2026-08-25 我把 `cpp_doc_comment` 的命令式定義刪掉之後，
 * tsc 說這個 import「宣告了而沒有被使用」，於是我刪了它。
 * **症狀不是報錯**：Blockly 對不認得的欄位型別是**安靜地丟掉那一格**
 * ——積木上的「說明」欄位整個不見，而程式碼那側仍然對
 *（因為 brief 活在語義樹裡）。**下一次從積木同步回去才會發現它沒了。**
 *
 * > **一個「沒有被使用」的 import，可能正是別人賴以存在的那一行。**
 *
 * 🔴 而 **`@blockly/field-multilineinput` 不會自我註冊**——2026-08-25 實測：
 * `require()` 之後 `registry.hasItem(FIELD, 'field_multilinetext')` 仍然是 `false`。
 * 所以光是 `import '…'` 沒有用，**要自己登記**（見下面的模組層級註冊）。
 *
 * 🟢 由 `tests/unit/ui/declared-field-types.test.ts` 釘住。
 */
import { FieldMultilineInput } from '@blockly/field-multilineinput'
import type { BlockSpecRegistry } from '../core/block-spec-registry'
import { CATEGORY_COLORS } from '../core/category-colors'
import { attachBranchList } from './branch-list-block'
// 🪦 `registerParamMutatorBlocks`／`MUTATOR_CONTAINER` 於 2026-08-26 從這裡的 import
//    移除——它們的呼叫點在 `defParamList` 工廠裡，而那個工廠隨 `cpp_forward_decl` 退場。
//    ⚠️ **查過了才刪**（`cpp_doc_comment` 那次的教訓：刪掉一個「沒被使用」的 import
//    把一個欄位取消註冊了，而測試全綠）——宣告式那條路的 `attachParamList`
//    **自己會呼叫** `registerParamMutatorBlocks`，不靠這裡的 import。
import { attachParamList } from './param-list-block'
import { attachAltLayout } from './alt-layout-block'
import { preserveForeignExtraState } from '../core/foreign-extra-state'
import { defineVariadicBlock, attachVariadic } from './variadic-block'
import { declareDropdownSource, registerDynamicDropdownField } from './dynamic-dropdown-field'
import { componentsDeclaringVariables, componentTraits } from '../core/component/traits'
import type { DropdownContext } from '../core/dropdown-sources'
import { deriveBlockType } from '../core/component/derive-block-type'
import { abstractComponentOf } from '../core/language-executors'
// 🪦 `setFieldSafely` 的匯入已於 2026-08-26 刪除——它的最後幾個消費者
//    （多模式插槽的 `SEL_i` 寫入）隨那套機制一起退場。
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
let C_VAR_DECLARE_EXPR_INPUTS: InputNames = { value: ['INIT_0'], statement: [] }
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
  varDeclareExpr: InputNames
}): void {
  C_VAR_DECLARE_EXPR_INPUTS = names.varDeclareExpr
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
    // ⚠️ 而註冊本身在**模組層級**（見檔尾的 `registerDeclaredFieldTypes`）：
    //    那是一次全域登記，不是每個實例的事，而**只在建構子裡做的話，
    //    「只 import 這個模組」的人拿不到它**。
    registerDeclaredFieldTypes()
    declareDropdownSource('names', (ctx) => this.getNameRefOptions(ctx))
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
  getNameRefOptions(ctx?: DropdownContext): Array<[string, string]> {
    const options = this.getWorkspaceVarOptions()
    // 🔴 **坐在寫入目標那一格時，常數一個都不給**（2026-08-26）。
    //
    //    上面那段寫的「其餘九個是寫入目標」在**左值接點化之後失效了**：
    //    `cpp_var_assign` 的 `NAME` 下拉不見了，賦值的左邊現在裝的**就是一顆
    //    `cpp_var_ref`**——而它用的是這裡這份「讀」的清單。
    //    於是學生點開賦值的左邊，看得到 `HIGH`。
    //
    // > **一個靠「你是哪一種積木」成立的區別，
    // > 在那兩種積木合而為一的那天會安靜地消失。**
    //
    // ⚠️ 而它**不會拋錯也不會讓單元測試變紅**（5749 支全綠）——
    //    抓到它的是 e2e 的 spec 149。
    if (this.isWriteTargetSlot(ctx)) return options
    const names = boardConstantOptions(this.currentBoard?.())
    if (!names) return options
    const seen = new Set(options.map((o) => o[1]))
    for (const n of names) if (!seen.has(n)) options.push([n, n])
    return options
  }

  /**
   * **這一格是不是寫入目標**——問宣告，不是問一份寫死的積木清單。
   *
   * 元件用 `traits.writesTo` 說自己寫進哪一格（語義插槽名，例如 `target`），
   * 而 `renderMapping.inputs` 把 Blockly 的 input 名（`TARGET`）翻回那個名字。
   *
   * ⚠️ **沒宣告的一律當成「不是」**——保守：多給幾個名字是小錯，
   * 少給是把使用者的變數藏起來。
   */
  private isWriteTargetSlot(ctx?: DropdownContext): boolean {
    if (!ctx?.parentBlockType || !ctx.parentInputName) return false
    const cid = this.componentIdOfBlockType(ctx.parentBlockType)
    if (!cid) return false
    const writesTo = componentTraits(cid)?.writesTo
    if (typeof writesTo !== 'string') return false
    const spec = this.blockSpecRegistry.getAll()
      .find((x) => (x.blockDef as { type?: string } | undefined)?.type === ctx.parentBlockType)
    const slot = (spec?.renderMapping?.inputs as Record<string, string> | undefined)
      ?.[ctx.parentInputName]
    return (slot ?? ctx.parentInputName.toLowerCase()) === writesTo
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

      // 🔴 **第四種形狀：依 `extraState` 換一整份佈局**（2026-08-25）
      //    —— `a += 2` 與 `a[i] += 2` 是同一顆積木，而欄位會換到別的插槽上。
      //    ⚠️ 在此之前宣告表達不出它，**而 spec 166 以為表達得出**：
      //       第五維證明的是「extraState 的鍵對得上」，不是「那一格會出現」。
      const altSpec = (blockDef as { altLayout?: Record<string, unknown> }).altLayout
      if (altSpec) {
        Blockly.Blocks[blockType] = { init: function (this: Blockly.Block) { this.jsonInit(blockDef as never) } }
        attachAltLayout(blockType, blockDef as never, {
          stateKey: altSpec.stateKey as string,
          alt: altSpec as never,
        })
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
          // ⚠️ 有插槽時才出現的一對括號——見 `VariadicSpec` 的說明
          openLabelKey: bd.openLabelKey as string | undefined,
          openLabelFallback: bd.openLabelFallback as string | undefined,
          closeLabelKey: bd.closeLabelKey as string | undefined,
          closeLabelFallback: bd.closeLabelFallback as string | undefined,
          // ⚠️ 存檔契約：接手既有積木時要沿用它原本的計數鍵
          countKey: bd.countKey as string | undefined,
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
          headInputName: bd.headInputName as string | undefined,
          slotPrefix: bd.slotPrefix as string | undefined,
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

    // 🪦 **`cpp_initializer_list` 的命令式定義已於 2026-08-26 刪除。**
    //
    //    換成 `builder: "variadic"`（`components/cpp/initializer_list/forms/blocks.json`）。
    //    存檔鍵 `itemCount` 沿用——渲染那一路的 `countSource` 認同一個。
    //
    // 🔴 **而兩份的形狀有一格差異，那個差異就是這一刀的目的**：
    //    命令式把「初始值」這個標籤掛在**第一個值插槽**上（`EXPR0,TAIL`），
    //    建構子把它放在自己的啞輸入上（`HEAD,EXPR0,TAIL`）。
    //
    //    spec 169 已經判過這件事，而**這一顆正是它舉的例子**：
    //    > 「一個『把標籤掛在第一個資料上』的版面，在資料可以是零個的時候就崩了。」
    //    而 `component.json` 說 `children.values.min: 0`——`{}` 是合法的。
    //
    //    ⚠️ 版面沒有變（`inputsInline: true`，標籤仍然在第一格左邊）。

    // 🪦 **`cpp_print` 的命令式定義已於 spec 162 刪除**——它改由
    //    `variadic-block.ts` 依膠囊的 `builder: "variadic"` ＋ `dynamicRules` 建。
    //    ⚠️ 刪掉而不是留著：`registerBlocksFromSpecs` 先跑，留著的那段
    //    **永遠不會被執行**，而死碼與活碼在中立性報表上一樣算一筆。

    // ─── Three-mode argument helpers ───
    // 🪦 **多模式插槽的整套機制已於 2026-08-26 刪除**
    //    （`BACK_IMG`／`COMPOSE_VAL`／`CUSTOM_VAL`／`ArgMode`／`ArgSlotState`／
    //     `buildArgSlot`／`rebuildArgSlot`）——它的五個消費者
    //    （`cin >>` ×2、兩顆格式化 I/O ×3）全部退場了。
    //
    // 🔴 而它退場的理由不是「沒有人用」，是**左值接點化讓它失去了理由**：
    //    那個 select 模式是「一格裝一個變數名的下拉」，而左值現在是接點。
    //
    // > **一個機制的存在理由，可能在另一條線做完的那天消失
    // > ——而它不會自己出聲，因為它還跑得動。**

    // 🪦 **`cpp_input` 與 `cpp_input_expression` 的命令式定義已於 2026-08-26 刪除**
    //    ——它們改由 `ui/variadic-block.ts` 依膠囊的 `builder: "variadic"` 建，
    //    與 `cpp_print`（`cout << a << b`）**同一個建構子**。
    //
    // 🔴 **這一刀不是「宣告與命令式一模一樣了」，是【判哪一邊對】**
    //    （`retire-imperative-block` 第 1 步）。路線圖本來寫著這顆缺
    //    「**多模式的插槽**」——一格可以是變數下拉、也可以是接點。
    //    而那個判斷是 2026-08-24 做的，**在左值接點化之前**。
    //
    //    左值接點化之後 `cin >> x` 的語義樹已經是 `values: [cpp:var_ref{x}]`，
    //    而每一顆賦值積木都改成用**接點**裝它的左值。於是那個 select 模式
    //    只剩一個理由：少一層巢狀——而它的代價是
    //    **`cin >> x >> y` 顯示成下拉，而它的鏡像 `cout << x << y` 顯示成接點**。
    //
    // > **兩個鏡像的運算，投影不該長得不一樣。**
    //
    // ⚠️ 而變數下拉**沒有消失**——它在 `cpp_var_ref` 積木上。
    // ⚠️ `custom` 模式（一個純文字欄位）一併退場：它從來不在宣告的 `modes` 裡，
    //    是命令式那份自己多出來的第三種。

    // 🪦 **兩顆格式化 I/O 的命令式定義已於 2026-08-26 刪除**
    //    （`cpp_print_formatted` · `cpp_input_formatted` · `cpp_input_formatted_expression`）
    //    ——它們改由 `ui/variadic-block.ts` 依膠囊的 `builder: "variadic"` 建。
    //
    // 🔴 **這一刀是【判哪一邊對】，不是「一模一樣了」**（`retire-imperative-block` 第 1 步）。
    //    宣告那份本來把參數**擠進一個文字欄位**（`ARGS: field_input`），
    //    而 `component.json` 說 `children: ['args']`——**參數在語義上是子節點**。
    //    所以錯的是宣告，而命令式的可變插槽是對的。
    //
    // ⚠️ 而每一格從「變數下拉／接點二選一」變成**單純的接點**，
    //    理由與 `cin >>` 同一條（2026-08-26）：左值接點化之後那個 select 模式
    //    只剩「少一層巢狀」，而它的代價是同族的積木投影不一致。
    //    → 那個差異**就是這一刀的目的**，驗收因此走 §3 的出口：
    //      ①寫下差異（這一段） ②對照組（來回轉換逐字相同） ③開瀏覽器（釘死環境）。
    //
    // 🟢 缺的兩個機制當天補上：`headInputName`（`FORMAT_ROW`——路線圖 2026-08-21
    //    就記著「啞輸入的名字要對得上，建構子要能指定」）與 `slotPrefix`（逗號）。

    // 🪦 **`isArrayVar` 已於 2026-08-26 刪除**——它的唯一消費者是
    //    多模式插槽（用來決定「這個變數是陣列嗎，要不要展開成下標」），
    //    而那整套隨兩顆格式化 I/O 一起退場了。


    // 🪦 **`cpp_endl` 的命令式定義已於 spec 163 刪除。**
    //    比對護欄（`audit-block-def-parity`）證明**兩份定義建出來的形狀一模一樣**
    //    ——插槽、欄位、output、statement、顏色逐項比過，才刪。

    // 🪦 **`cpp_if` 的命令式定義已於 2026-08-24 刪除**——比對護欄確認一模一樣。
    //
    //    它換成宣告：`components/cpp/if/forms/blocks.json` 的 `branchList`
    //    （插槽名 `ELSEIF_CONDITION_{i}`／`ELSEIF_THEN_{i}`／`ELSE`／`TAIL`
    //    **沿用命令式那一份**，存檔與渲染策略吐的鍵因此一字不差）。
    //
    //    一起走的還有三顆 mutator 小積木（`u_if_container`／`u_if_elseif_input`／
    //    `u_if_else_input`）——建構子自己會長一組同形狀的。
    //
    // ⚠️ **`cpp_if_else` 原本是它的別名**，現在回到自己的宣告（靜態的
    //    如果／則／否則）。它**不在工具箱裡**（`toolbox-categories.ts` 逐字
    //    「被下面三個帶 extraState 的 cpp_if 入口取代」），只剩舊存檔會用到它。
    //
    // 🔴 **判準是「比對護欄說它們一模一樣」**，不是「看起來很像」——
    //    而在那之前修的是**比對器**：它原本只跑 `jsonInit`，看不到三個建構子。

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


    // 🪦 **`defParamList` 這個工廠已於 2026-08-26 刪除**——它的兩個消費者
    //    （`cpp_func_def` 2026-08-24、`cpp_forward_decl` 2026-08-26）都退場了。
    //
    //    它當初是為了**已經重複**而抽出來的（`cpp_func_def` 與 `cpp_forward_decl`
    //    的 `loadExtraState` 100% 相同、`minusParam_` 96%、`plusParam_` 89%），
    //    而抄過去的時候就漏了 i18n——`cpp_forward_decl` 的括號寫死 `'('`／`')'`。
    //
    // 🔴 **而它列的三個「變異點」裡，有一個其實是缺陷**：
    //
    //    | | `cpp_func_def` | `cpp_forward_decl` |
    //    |---|---|---|
    //    | 帶名字欄位 | ✅ | ❌ ← **這一格不是設定，是資料在掉** |
    //
    //    2026-08-26 量到：渲染器吐出 `PARAM_0:"a"`，而那顆積木上沒有那個欄位
    //    ——`int add(int a, int b);` 經過積木一趟變成 `int add(int, int);`。
    //
    // > **一張「三個變異點」的表，會讓其中的缺陷看起來像一個選項。**
    //
    //    宣告式的 `paramList`（`ui/param-list-block.ts`）取代了它，
    //    而那三個變異點全部變成宣告裡的資料。


    // 🪦 **`cpp_func_def` 的命令式定義已於 2026-08-24 刪除**——比對護欄確認一模一樣。
    //
    //    換成宣告：`components/cpp/func_def/forms/blocks.json` 的 `paramList`
    //    （欄位名 `TYPE_{i}`／`PARAM_{i}`／`PARAM_DEFAULT_{i}` 與存檔 `{paramCount}`
    //    **沿用命令式那一份**；插槽名 `HEADER`／`PARAMS_LABEL`／`PARAMS_END` 也是）。
    //
    // 🔴 **兩個型別下拉搬回語言套件**（`languages/cpp/pack.ts` 的
    //    `cpp_param_types`／`cpp_return_types`）——`int`／`char*`／`long long`
    //    是**那個語言的東西**，而它們原本住在這個核心 UI 檔裡（P9 的債）。
    //    ⚠️ 那不是順手清理：**宣告式的下拉只拿得到「宣告過的來源」**，
    //    於是它逼著那份清單回家。
    //
    // cpp_func_call
    {
      // 🪦 **`cpp_func_call` 與 `cpp_func_call_expression` 的命令式定義已於
      //    2026-08-24 刪除**——比對護欄確認一模一樣。換成宣告：
      //    `components/cpp/func_call/forms/blocks.json` 的 `builder: "variadic"`
      //    ＋ `field_dynamic_dropdown`（`funcs`）＋ 具名的 `LABEL` 那一列。
      //
      // 🔴 **那對括號差點掉了**：命令式在 `rebuildArgLabels_`（只在加減引數時跑）
      //    才長出 `（`／`）`，而比對護欄只比「剛建好的樣子」——0 個引數時兩邊都沒有括號，
      //    於是它說「一模一樣」。是 `retire-imperative-block` 第 3 步那一問
      //    （「它有沒有一段只在別的時機才跑的邏輯？」）把它問出來的。
      //    🟢 建構子因此多了 `openLabel*`／`closeLabel*`（有插槽時才出現）。
      //
      // ⚠️ 判準是「比對護欄說一模一樣」＋「那一問」——**兩個都要**。
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
    // 🪦 **`cpp_raw_code` 的命令式定義已於 2026-08-26 刪除**——**最後一顆**。
    //
    // 🔴 路線圖寫著它缺一個「**依 extraState 換視覺**」的宣告機制，
    //    而實測之後那句話只對了一半：
    //
    //    ① **換視覺那一半已經有了**——`blockly-panel` 的 `applyExtraStateVisuals`
    //       對**每一顆積木**套用 `degradationCause` 與 `confidence` 的顏色與 tooltip。
    //       這顆的 `loadExtraState` 裡那段 `degradationCause` **是重複的**。
    //       只有 `unresolved` 那一支沒被搬過去——這一刀把它搬了。
    //
    //    ② **真正缺的是【存得活】**：Blockly 對一顆沒有 `save/loadExtraState`
    //       的積木**根本不保存 `extraState`**（實測：載入再存回去得到 `{}`）。
    //       → `preserveForeignExtraState` 補上「純轉手」那一支。
    //
    // ⚠️ 而 ② 是一個**比這顆積木大得多**的缺陷：
    //    **每一顆宣告式積木都在丟掉整份 `extraState`**——包含使用者打的行末註解。
    //    那個模組的檔頭寫的正是這個症狀，而它只修了 mutation 積木那一半。
    //    **每退一顆命令式定義，那個洞就大一分。**
    //
    // > **一份路線圖項目寫著「缺的是 X」，而 X 在別的目的下被做出來了
    // > ——那條就不再是待辦，是誤導。**（同一個項目上的第四次）


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

    // 🪦 **`cpp_increment` 的命令式定義已於 2026-08-25 刪除**
    //    （比對護欄確認一模一樣）。宣告在
    //    `components/cpp/increment/forms/blocks.json`。
    //
    //    它需要的機制是那一刀補的：**`altLayout` —— 依 `extraState` 換一整份佈局**
    //    （`a++` 與 `a[i]++` 是同一顆積木，而欄位會換到別的插槽上）。
    //
    // 🔴 **而做它的時候發現 `cpp_var_assign_compound` 在 spec 166 退場時就壞了**：
    //    那顆的宣告裡沒有 `INDEX` 這一格，於是 `a[i] += 2` 的索引安靜地掉。
    //    墓碑寫著「宣告表達得出（第五維證明的）」——⚠️ **而第五維證明的是
    //    「extraState 的鍵對得上」，不是「那一格會出現」**。
    //
    // > **一條護欄的能力邊界被讀成比它大的東西，比沒有那條護欄更危險
    // > ——它讓人停止懷疑。**
    //
    //    🟢 由 `tests/integration/audit-optional-slot.test.ts` 釘住（硬性零）。

    // 🪦 **`cpp_var_assign_compound` 的命令式定義已於 spec 166 刪除**（比對護欄確認一模一樣）。
    //    ⚠️ 而它的 `hasIndex`（載入時加／移除 `INDEX` 插槽）**宣告表達得出**
    //    （`extraStateFlags`）——那一點是**護欄新增的第五維**證明的，不是我猜的。

    // 🪦 **`cpp_forward_decl` 的命令式定義已於 2026-08-26 刪除——而這一顆是【判命令式錯了】。**
    //
    //    它用 `withNameField: false`，每格參數**只有型別下拉**，
    //    而它原本的註解說「前向宣告不需要名字」。那句話對 C++ 文法成立，
    //    **對這個系統不成立**：語義樹的 `param_decl` 帶著 `name`／`default`，
    //    抬升讀得到、產生器印得出，**而積木收不下**。
    //
    //    實測 `int add(int a, int b);`：渲染器吐出 `PARAM_0:"a"`，
    //    積木上只有 `RETURN_TYPE / NAME / TYPE_0 / TYPE_1`，`PARAM_0` 讀回來是 `null`
    //    ——經過積木一趟就變成 `int add(int, int);`。
    //
    // > **一顆積木「不需要」某個欄位，與那個欄位「不會被送進來」是兩件事
    // > ——而前者寫在註解裡，後者要量才看得到。**
    //
    // ⚠️ 而比對護欄那天說「一模一樣」——因為參數欄位**只在載入時才長出來**，
    //    而它只比「剛建好的樣子」（`retire-imperative-block` §3）。
    //
    // 🪦 連同 `defParamList` 工廠、`getParamTypeOptions`、`getReturnTypeOptions`
    //    一起退場——它們的唯一消費者就是這一顆。
    //    型別清單住在 `languages/cpp/pack.ts` 的 `cpp_param_types`／`cpp_return_types`。

    // 🪦 **`cpp_comment` 的命令式定義已於 spec 165 刪除**（比對護欄確認一模一樣）。

    // 🪦 **`cpp_block_comment` 的命令式定義已於 spec 165 刪除**（比對護欄確認一模一樣）。

    // 🪦 **`cpp_doc_comment` 的命令式定義已於 2026-08-25 刪除**
    //    （連同齒輪的三顆小積木 `c_doc_container`／`c_doc_param_input`／
    //    `c_doc_return_input`）。
    //
    //    宣告在 `components/cpp/doc_comment/forms/blocks.json`，
    //    而它需要的兩個機制是那一刀補的：
    //
    //    ```
    //    plusMinus: false          只有齒輪、沒有 +／−  ——與命令式一字不差
    //    blockOptions[].fields     回傳那一列【用完才建】，不是藏起來
    //    ```
    //
    //    🔴 **「看不見」與「不存在」在使用者眼裡一樣，在比對器眼裡不一樣**
    //    ——藏起來的那一格仍然在插槽清單裡，於是永遠到不了「一模一樣」。
    //
    //    ⚠️ 而 `retire-imperative-block` 明令**不要在退場那一刀順手改 UX**：
    //    我一度判成「加 +／− 比較好」，那個問題另記，不夾帶。

    // ── Expression versions ──

    // 🪦 **`cpp_increment_expression` 與 `cpp_var_assign_compound_expression` 的
    //    命令式定義已於 2026-08-25 刪除**（路線圖「左值是接點，不是字串」）。
    //
    //    它們的存在理由是那個 `hasIndex_` mutator——**依 extraState 加／移除
    //    一個 `INDEX` 插槽**，而那一格是為了讓 `a[i]++` 的索引顯示出來。
    //
    // 🟢 左值換成 `TARGET` 接點之後那一格不存在了：`a[i]` 就只是插在
    //    `TARGET` 上的一顆 `cpp_array_at`，而宣告完整表達得出。
    //
    // 🔴 **而抓到它們沒退場的是第五十一條護欄**（硬性零）：宣告已經產出
    //    `TARGET`，而命令式那份仍然建 `NAME`／`INDEX`，於是**12 段語料的
    //    積木狀態載不進工作區**。比對報表看不到這個——它比的是「剛建好的樣子」。
    //
    // > **兩份定義的落差，不一定表現成「長得不一樣」——
    // > 也可能表現成「一份產出的東西，另一份收不下」。**



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

/**
 * **宣告裡用得到的欄位型別，一次登記完**。
 *
 * 🔴 在模組層級，不在建構子裡——`jsonInit` 查不到型別時是**安靜地丟掉那一格**，
 * 而那個症狀（積木上少一個欄位、程式碼那側卻仍然對）比建不起來難發現得多。
 *
 * ⚠️ 兩者都不是「import 就好」：
 *
 * ```
 * field_dynamic_dropdown   我們自己的類別，要呼叫 registerDynamicDropdownField()
 * field_multilinetext      @blockly/field-multilineinput **不會自我註冊**（2026-08-25 實測）
 * ```
 *
 * 🟢 由 `tests/unit/ui/declared-field-types.test.ts` 釘住（硬性零）。
 */
export function registerDeclaredFieldTypes(): void {
  registerDynamicDropdownField()
  if (!Blockly.registry.hasItem(Blockly.registry.Type.FIELD, 'field_multilinetext')) {
    Blockly.fieldRegistry.register('field_multilinetext', FieldMultilineInput as never)
  }
}

// 🔴 **模組被載入就登記**——理由見上面那一段。
registerDeclaredFieldTypes()
