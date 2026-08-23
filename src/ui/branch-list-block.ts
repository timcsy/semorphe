/**
 * 從**宣告**替一顆積木接上「可增減的分支」——`if / elif… / else` 的那一種。
 *
 * ## 這是第三種可增減的形狀
 *
 * ```
 * variadic     加減【值插槽】       EXPR0、EXPR1…                每格接一顆積木
 * paramList    加減【欄位組】       PARAM_0、PARAM_1…            每格是文字／下拉欄位
 * branchList   加減【成對的插槽】   ELIF_CONDITION_i ＋ ELIF_BODY_i   一個值 ＋ 一段語句
 *              ＋ 一個【可有可無】的尾巴（else）
 * ```
 *
 * ⚠️ 「成對」是它與 variadic 的關鍵差別：兩個插槽**同進同出**，
 * 而它們在語義樹上是**兩個接點靠索引配對**。
 *
 * > **兩個靠索引配對的清單，只要有一個地方少加一格，配對就整條錯開
 * > ——而錯開之後每一格都還在，只是接錯了人。**
 * > 所以加減一律走 `plusBranch_`／`minusBranch_`，不准分開動。
 *
 * ## extraState 的鍵沿用命令式那份
 *
 * `{ elseifCount, hasElse }`——與 `block-registrar` 裡 `cpp_if` 的一字不差。
 * 🟢 **那是刻意的**：這個建構子的下一個消費者就是它（vision 記著的那 10 筆之一），
 * 而換一個鍵名等於讓那顆退不了場。
 */
import * as Blockly from 'blockly'

/* eslint-disable @typescript-eslint/no-explicit-any */

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

export interface BranchListSpec {
  /** 每個分支的條件插槽名（`ELIF_CONDITION_{i}`） */
  conditionPattern: string
  /** 每個分支的語句插槽名（`ELIF_BODY_{i}`） */
  bodyPattern: string
  conditionLabelKey?: string
  conditionLabelFallback?: string
  bodyLabelKey?: string
  bodyLabelFallback?: string
  /** 尾巴那個可有可無的語句插槽（else） */
  elseInput: string
  elseLabelKey?: string
  elseLabelFallback?: string
  /** mutator 對話框裡那顆容器積木的標籤 */
  containerLabelKey?: string
  containerLabelFallback?: string
  colour: string | number
  /**
   * **每個標頭一格註解欄位**（2026-08-23）——`if a:  # 為什麼` 的那個「為什麼」。
   *
   * 🔴 在這之前它只住在 `extraState` 裡：轉得回去、而**積木上看不到也改不掉**。
   *
   * > **使用者打的字要有一個看得到的家。**
   *
   * ⚠️ 欄位名要與膠囊 `renderMapping.annotationFields` 宣告的**一字不差**
   * ——那份宣告說的是「哪一格裝哪一行的註解」，這裡長出來的是那一格本身。
   */
  notes?: {
    headerInput: string
    headerField: string
    elifPattern: string
    elseField: string
    marker?: string
    toggleLabelKey?: string
    toggleLabelFallback?: string
  }
}

const at = (p: string, i: number): string => p.replace('{i}', String(i))

/** 存檔格式——`elseifCount`／`hasElse` 與命令式那份一字不差，其餘是註解那一段的。 */
interface BranchExtraState {
  elseifCount?: number
  hasElse?: boolean
  showNotes?: boolean
  noteText?: Record<string, string>
}

export function attachBranchList(type: string, spec: BranchListSpec): void {
  const proto = Blockly.Blocks[type] as any
  if (!proto) throw new Error(`attachBranchList：積木型別 ${type} 還沒被定義——順序反了`)
  const msg = Blockly.Msg as Record<string, string>
  const baseInit = proto.init
  // ⚠️ **齒輪裡的標題不能直接借積木的訊息鍵**——那些鍵帶著 `%1`（插槽的位置），
  //    而小積木上沒有插槽，於是使用者看到的是字面的「如果 %1 顯示註解」。
  //    🔴 2026-08-23 開瀏覽器看到的；宣告已改成專屬的鍵，這裡是第二道。
  const text = (k: string | undefined, f: string | undefined): string =>
    ((k ? msg[k] || f : f) ?? '').replace(/\s*%\d+/g, '')

  const setMinus = (b: any): void => {
    const f = b.getField('BL_MINUS')
    if (f) f.setValue(b.elseifCount_ <= 0 ? MINUS_DISABLED_IMG : MINUS_IMG)
  }

  proto.rebuildTail_ = function (this: any): void {
    if (this.getInput('BL_TAIL')) this.removeInput('BL_TAIL')
    const hadElse = this.hasElse_ === true && this.getInput(spec.elseInput) !== null
    this.appendDummyInput('BL_TAIL')
      .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plusBranch_()))
      .appendField(
        new Blockly.FieldImage(
          this.elseifCount_ <= 0 ? MINUS_DISABLED_IMG : MINUS_IMG, 20, 20, '-', () => this.minusBranch_(),
        ),
        'BL_MINUS',
      )
    // ⚠️ 重建之後 `BL_TAIL` 會跑到最後——**再把它移回 else 之前**，
    //    否則每次加減分支都會讓 `⊕⊖` 與 `否則` 交換位置。
    if (hadElse) this.moveInputBefore('BL_TAIL', spec.elseInput)
  }

  // 🔴 **mutator 對話框裡的三顆小積木**——與 C++ 那顆一模一樣的形狀
  //    （`u_if_container` / `u_if_elseif_input` / `u_if_else_input`）。
  //
  // ⚠️ 第一版沒有它們，改用一顆「E」按鈕開關 else。使用者 2026-08-21：
  // 「請你做的跟 C++ 那邊一致」——**兩個語言的同一顆積木，互動方式不該不一樣**。
  //
  // > **一致性不是美觀問題：學生在兩個語言之間切換時，
  // > 手勢不同等於要重學一次同一個概念。**
  const mini = (suffix: string, label: string, stack: boolean): void => {
    Blockly.Blocks[`${type}_${suffix}`] = {
      init: function (this: Blockly.Block) {
        const head = this.appendDummyInput().appendField(label)
        // ⚠️ **勾選格只掛在容器上**（`stack` 那顆）——分支小積木上不需要，
        //    註解是「整顆積木要不要顯示」的一個開關，不是每支分支各自的。
        if (stack && spec.notes) {
          head.appendField(text(spec.notes.toggleLabelKey, spec.notes.toggleLabelFallback ?? '顯示註解'))
          head.appendField(new Blockly.FieldCheckbox('FALSE') as Blockly.Field, 'BL_NOTES')
        }
        if (stack) this.appendStatementInput('STACK')
        else { this.setPreviousStatement(true); this.setNextStatement(true) }
        this.setColour(spec.colour)
        ;(this as unknown as { contextMenu: boolean }).contextMenu = false
      },
    }
  }
  mini('container', text(spec.containerLabelKey, spec.containerLabelFallback), true)
  mini('elseif_input', text(spec.conditionLabelKey, spec.conditionLabelFallback), false)
  mini('else_input', text(spec.elseLabelKey, spec.elseLabelFallback), false)

  /** 一格註解欄位——`＃` 標記 ＋ 文字欄。找不到那個插槽就當作沒有（分支還沒長出來）。 */
  const addNote = (b: any, input: string, field: string): void => {
    const i = b.getInput(input)
    if (!i || i.fieldRow.some((f: any) => f.name === field)) return
    i.appendField(new Blockly.FieldLabel(spec.notes?.marker ?? '＃') as Blockly.Field, `${field}_MARK`)
    // 🔴 **收起來的時候寄放在這裡，打開就拿回來**（見 `setNotes_` 的說明）
    i.appendField(new Blockly.FieldTextInput(b.noteText_?.[field] ?? '') as Blockly.Field, field)
  }
  const dropNote = (b: any, input: string, field: string): void => {
    const i = b.getInput(input)
    if (!i) return
    if (i.fieldRow.some((f: any) => f.name === field)) {
      // ⚠️ **先寄放再拆**——欄位一拆，它的值就跟著沒了
      b.noteText_ = { ...(b.noteText_ ?? {}), [field]: b.getFieldValue(field) ?? '' }
      i.removeField(field)
    }
    if (i.fieldRow.some((f: any) => f.name === `${field}_MARK`)) i.removeField(`${field}_MARK`)
  }

  /** 這顆積木上所有「標頭 → 註解欄位」的配對——分支幾支就幾對。 */
  proto.noteSlots_ = function (this: any): [string, string][] {
    const n = spec.notes
    if (!n) return []
    const out: [string, string][] = [[n.headerInput, n.headerField]]
    for (let i = 0; i < this.elseifCount_; i++) {
      out.push([at(spec.bodyPattern, i), at(n.elifPattern, i)])
    }
    if (this.hasElse_) out.push([spec.elseInput, n.elseField])
    return out
  }

  /**
   * **關掉＝那句話從程式碼裡收起來，而不是被燒掉。**
   *
   * 🔴 第一版真的把字丟了，而開瀏覽器一試就看到代價：**「還原」救不回來**
   * （拆掉的欄位不在 Blockly 的復原事件裡）。
   *
   * > **一個救不回來的動作，不該藏在一個勾選格後面。**
   *
   * 🟢 所以收起來的字寄放在 `noteText_`（跟著存檔走），再勾一次就回來；
   * 而收著的期間它**不會**出現在程式碼裡——擷取那一路只認欄位。
   */
  proto.setNotes_ = function (this: any, show: boolean): void {
    if (!spec.notes) return
    this.showNotes_ = show
    for (const [input, field] of this.noteSlots_()) {
      if (show) addNote(this, input, field)
      else dropNote(this, input, field)
    }
  }

  proto.init = function (this: any): void {
    baseInit.call(this)
    this.elseifCount_ = 0
    this.hasElse_ = false
    this.showNotes_ = false
    this.noteText_ = {}
    this.rebuildTail_()
    this.setMutator(new Blockly.icons.MutatorIcon(
      [`${type}_elseif_input`, `${type}_else_input`],
      this as unknown as Blockly.BlockSvg,
    ))
  }

  proto.decompose = function (this: any, workspace: Blockly.WorkspaceSvg): Blockly.Block {
    const container = workspace.newBlock(`${type}_container`)
    container.initSvg()
    if (spec.notes) container.setFieldValue(this.showNotes_ ? 'TRUE' : 'FALSE', 'BL_NOTES')
    let conn = container.getInput('STACK')!.connection!
    for (let i = 0; i < this.elseifCount_; i++) {
      const b = workspace.newBlock(`${type}_elseif_input`)
      b.initSvg(); conn.connect(b.previousConnection!); conn = b.nextConnection!
    }
    if (this.hasElse_) {
      const b = workspace.newBlock(`${type}_else_input`)
      b.initSvg(); conn.connect(b.previousConnection!)
    }
    return container
  }

  proto.compose = function (this: any, container: Blockly.Block): void {
    let n = 0
    let wantElse = false
    let clause = container.getInputTargetBlock('STACK')
    while (clause) {
      if (clause.type === `${type}_elseif_input`) n++
      else if (clause.type === `${type}_else_input`) wantElse = true
      clause = clause.getNextBlock()
    }
    // ⚠️ 走既有的加減函式重建——**不要直接設欄位**，插槽是它們長出來的。
    while (this.elseifCount_ < n) this.plusBranch_()
    while (this.elseifCount_ > n) this.minusBranch_()
    if (wantElse !== this.hasElse_) this.toggleElse_()
    // ⚠️ **最後才處理註解格**——插槽要先在，欄位才掛得上去。
    if (spec.notes) this.setNotes_(container.getFieldValue('BL_NOTES') === 'TRUE')
  }

  proto.plusBranch_ = function (this: any): void {
    const i = this.elseifCount_
    this.appendValueInput(at(spec.conditionPattern, i))
      .setCheck('Expression')
      .appendField(text(spec.conditionLabelKey, spec.conditionLabelFallback))
    this.appendStatementInput(at(spec.bodyPattern, i))
      .setCheck('Statement')
      .appendField(text(spec.bodyLabelKey, spec.bodyLabelFallback))
    // ⚠️ 兩個都要移到尾巴前面，而且**順序不能顛倒**——顛倒的話語句插槽會跑到條件上面。
    this.moveInputBefore(at(spec.conditionPattern, i), 'BL_TAIL')
    this.moveInputBefore(at(spec.bodyPattern, i), 'BL_TAIL')
    this.elseifCount_++
    if (this.showNotes_ && spec.notes) addNote(this, at(spec.bodyPattern, i), at(spec.notes.elifPattern, i))
    setMinus(this)
  }

  proto.minusBranch_ = function (this: any): void {
    if (this.elseifCount_ <= 0) return
    this.elseifCount_--
    const i = this.elseifCount_
    // 🔴 **兩個一起移除**——只移一個的話下一次 `plusBranch_` 會撞名，
    //    而 Blockly 對重複的 input 名不報錯，它只是安靜地不接上。
    this.removeInput(at(spec.bodyPattern, i))
    this.removeInput(at(spec.conditionPattern, i))
    setMinus(this)
  }

  proto.toggleElse_ = function (this: any): void {
    if (this.hasElse_) {
      this.removeInput(spec.elseInput)
      this.hasElse_ = false
    } else {
      // 🔴 **else 放在 `+`／`−` 【後面】**（使用者 2026-08-21：「mutation 和 C++
      // 那邊的放置位置好像有點出入」）——`appendStatementInput` 直接接在最後就是對的。
      //
      // ⚠️ 第一版多寫了一行 `moveInputBefore(elseInput, 'BL_TAIL')` 把它移到前面，
      // 於是版面變成「如果／則／否則／⊕⊖」，而 C++ 是「如果／則／⊕⊖／否則」。
      //
      // > **`+` 的位置說的是「按了會加在哪裡」——把它放在 else 後面，
      // > 讀起來像「按了會多一個 else」。**
      this.appendStatementInput(spec.elseInput)
        .setCheck('Statement')
        .appendField(text(spec.elseLabelKey, spec.elseLabelFallback))
      this.hasElse_ = true
      if (this.showNotes_ && spec.notes) addNote(this, spec.elseInput, spec.notes.elseField)
    }
  }

  proto.saveExtraState = function (this: any): BranchExtraState | null {
    const s: BranchExtraState = {}
    if (this.elseifCount_ > 0) s.elseifCount = this.elseifCount_
    if (this.hasElse_) s.hasElse = true
    if (this.showNotes_) s.showNotes = true
    // 收起來的那幾句話要跟著存檔走，否則「再勾一次」拿回來的是空的
    const stash: Record<string, string> = {}
    for (const [k, v] of Object.entries((this.noteText_ ?? {}) as Record<string, string>)) if (v) stash[k] = v
    if (!this.showNotes_ && Object.keys(stash).length > 0) s.noteText = stash
    return Object.keys(s).length > 0 ? s : null
  }

  proto.loadExtraState = function (this: any, state: BranchExtraState | null): void {
    this.noteText_ = { ...(state?.noteText ?? {}) }
    const want = state?.elseifCount ?? 0
    // ⚠️ 靠反覆呼叫重建，不要直接設欄位——插槽是那兩個函式長出來的。
    while (this.elseifCount_ < want) this.plusBranch_()
    while (this.elseifCount_ > want) this.minusBranch_()
    const wantElse = state?.hasElse === true
    if (wantElse !== this.hasElse_) this.toggleElse_()
    // 🔴 **註解格最後長**——渲染那一路靠 `showNotes` 讓它先存在，欄位值才落得進來。
    if (spec.notes) this.setNotes_(state?.showNotes === true)
  }
}
