/**
 * 從**宣告**替一顆積木接上「可增減的參數列」——`+`／`−` 加減**欄位組**的那一種。
 *
 * ## 為什麼是另一個模組
 *
 * `variadic-block.ts` 的檔頭自己寫著它不處理這一種：
 *
 * > 🔴 不適用　每項一組**多個**欄位（`cpp_func_def` 的 `TYPE_{i}`＋`PARAM_{i}`）
 * >          → 那是同一個宣告的另一種形狀，這一版不處理
 *
 * 兩者的差別是**加減的是什麼**：
 *
 * ```
 * variadic    加減【值插槽】   EXPR0、EXPR1…      每格接一顆積木
 * paramList   加減【欄位組】   PARAM_0、PARAM_1…  每格是一到多個文字／下拉欄位
 * ```
 *
 * ## 🔴 它與 variadic 的另一個關鍵差別：**它不建整顆積木**
 *
 * `defineVariadicBlock` 從零建一顆（因為那種積木除了插槽幾乎沒有別的）。
 * 而參數列長在一顆**本來就有內容**的積木上（`def f(…):` 有名字、有函式體），
 * 所以這裡是**接上去**：`jsonInit` 先建靜態的部分，這個函式再補動態的那一段。
 *
 * > **一個「從零建整顆」的建構子，遇到「只有一部分是動態的」積木時，
 * > 唯一的出路是把靜態的部分也吞進去——而那正是它會弄丟欄位的原因。**
 *
 * ## extraState 的格式是契約
 *
 * `{ paramCount }`——與 `block-registrar` 那份命令式的一字不差。
 * 舊存檔裡就是那個形狀，換一個鍵名等於讓使用者的檔案打不開。
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

export interface ParamListSpec {
  /** 每一格的 input 名（`PARAM_{i}`） */
  itemPattern: string
  /** 每一格裡的欄位。`{i}` 會換成序號 */
  fields: { type: string; name: string; text?: string; source?: string; options?: unknown }[]
  /** 每一格之間的分隔字（第一格前面不放） */
  separator?: string
  /** 開／閉括號的 i18n 鍵與 fallback。**沒有參數時兩者都不顯示** */
  openLabelKey?: string
  openLabelFallback?: string
  closeLabelKey?: string
  closeLabelFallback?: string
  /** `+`／`−` 那一列要移到哪個 input 之前（`null` ＝ 放在最後） */
  moveTailTo?: string | null
  /**
   * **最少要有幾格**（預設 0）。
   *
   * 🔴 `for` 迴圈是 1：**零個名字的 for 不是合法的 Python**（`for  in xs:`），
   * 而工具箱拖出來的那一顆用的就是初始值——學生看到的是「對 ⬤」，
   * 中間少了那個要被綁定的名字。
   *
   * ⚠️ 而函式定義與匿名函式是 **0**：`def f():` 與 `lambda: 3` 都合法。
   *
   * > **「最少幾格」是那個語言的規則，所以它是一個宣告，不是一個預設值。**
   */
  minCount?: number
}

function setMinusState(block: any, atMin: boolean): void {
  const f = block.getField('PL_MINUS')
  if (f) f.setValue(atMin ? MINUS_DISABLED_IMG : MINUS_IMG)
}

const name = (pattern: string, i: number): string => pattern.replace('{i}', String(i))

/**
 * 把參數列接到一個**已經 `jsonInit` 過**的積木原型上。
 *
 * ⚠️ **接在原型（`Blockly.Blocks[type]`）上而不是實例上**——
 * `init` 在每一顆積木被建立時跑，而 `plus_`／`saveExtraState` 要在原型上才被所有實例看見。
 */
export function attachParamList(type: string, spec: ParamListSpec): void {
  const proto = Blockly.Blocks[type] as any
  if (!proto) throw new Error(`attachParamList：積木型別 ${type} 還沒被定義——順序反了`)
  const msg = Blockly.Msg as Record<string, string>
  const baseInit = proto.init

  const label = (key: string | undefined, fallback: string | undefined): string | undefined =>
    key ? (msg[key] || fallback) : fallback

  const minCount = spec.minCount ?? 0
  proto.paramCount_ = 0

  proto.rebuildTail_ = function (this: any): void {
    if (this.getInput('PL_OPEN')) this.removeInput('PL_OPEN')
    if (this.getInput('PL_TAIL')) this.removeInput('PL_TAIL')
    const open = label(spec.openLabelKey, spec.openLabelFallback)
    const close = label(spec.closeLabelKey, spec.closeLabelFallback)
    if (this.paramCount_ > 0 && open) {
      this.appendDummyInput('PL_OPEN').appendField(open)
      this.moveInputBefore('PL_OPEN', name(spec.itemPattern, 0))
    }
    const tail = this.appendDummyInput('PL_TAIL')
    // ⚠️ 閉括號只在**有參數時**顯示——零參數時 `def f():` 的括號由產生器補，
    //    而積木上顯示一對空括號會讓「沒有參數」看起來像「有一個空參數」。
    if (this.paramCount_ > 0 && close) tail.appendField(close)
    tail
      .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plusParam_()))
      .appendField(
        new Blockly.FieldImage(
          this.paramCount_ <= minCount ? MINUS_DISABLED_IMG : MINUS_IMG, 20, 20, '-', () => this.minusParam_(),
        ),
        'PL_MINUS',
      )
    if (spec.moveTailTo && this.getInput(spec.moveTailTo)) this.moveInputBefore('PL_TAIL', spec.moveTailTo)
  }

  proto.init = function (this: any): void {
    baseInit.call(this)
    this.paramCount_ = 0
    this.rebuildTail_()
    // 🔴 **最少那幾格要在【建的當下】就長出來**——工具箱拖出來的那一顆
    //    用的就是這個狀態，而 `for` 少了那個名字產不出合法的 Python。
    while (this.paramCount_ < minCount) this.plusParam_()
  }

  proto.plusParam_ = function (this: any): void {
    const i = this.paramCount_
    const input = this.appendDummyInput(name(spec.itemPattern, i))
    if (i > 0 && spec.separator) input.appendField(spec.separator)
    for (const f of spec.fields) {
      const json = { ...f, name: f.name.replace('{i}', String(i)) } as Record<string, unknown>
      if (typeof json.text === 'string') json.text = (json.text as string).replace('{i}', String(i))
      const field = Blockly.fieldRegistry.fromJson(json as never)
      if (field) input.appendField(field, json.name as string)
    }
    this.moveInputBefore(name(spec.itemPattern, i), 'PL_TAIL')
    this.paramCount_++
    this.rebuildTail_()
  }

  proto.minusParam_ = function (this: any): void {
    if (this.paramCount_ <= minCount) return
    this.paramCount_--
    this.removeInput(name(spec.itemPattern, this.paramCount_))
    this.rebuildTail_()
    setMinusState(this, this.paramCount_ <= minCount)
  }

  // ⚠️ **格式是契約**：`{ paramCount }`，與命令式那份一字不差。
  //    而零參數回 `null`——那也是命令式那份的行為（存檔裡不留空物件）。
  proto.saveExtraState = function (this: any): { paramCount: number } | null {
    return this.paramCount_ > 0 ? { paramCount: this.paramCount_ } : null
  }

  proto.loadExtraState = function (this: any, state: { paramCount?: number } | null): void {
    // ⚠️ **舊存檔沒有這個鍵時要退到【最少幾格】不是 0**——`for` 的舊檔
    //    若被載回 0 格，產出的會是 `for  in xs:`。
    const want = Math.max(state?.paramCount ?? 0, minCount)
    // ⚠️ **靠反覆呼叫 `plusParam_` 重建，不要直接設 `paramCount_`。**
    // 舊存檔只存了數字，插槽是這裡長出來的——改掉這個機制，舊存檔就載不回來。
    while (this.paramCount_ < want) this.plusParam_()
    while (this.paramCount_ > want) this.minusParam_()
  }
}
