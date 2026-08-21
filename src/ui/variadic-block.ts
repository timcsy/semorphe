/**
 * 從**宣告**建一顆可變參數的積木——`+`／`−` 加減插槽的那一種。
 *
 * ## 為什麼有這個模組
 *
 * `renderMapping.dynamicRules` **早就宣告在膠囊裡**（16 顆），而讀它的只有
 * 投影那一半（`PatternRenderer`／`PatternExtractor`）。
 * **積木型別的【定義】那一半是命令式的**，寫死在 `block-registrar.ts` 裡，
 * 一顆一段、只認 `cpp_*`。
 *
 * 症狀在 spec 160 具體出現過：第二個語言的第一顆積木宣告了 `dynamicRules`，
 * 而瀏覽器報 `The block "python_print" is missing a(n) EXPR0 connection`
 * ——**宣告有了，沒有人照著它建那些 input**。
 *
 * > `vision` 逐字：「它等的是第二個語言的第一顆【積木】」——而它等到了。
 *
 * ## 判準：什麼樣的積木適用
 *
 * ```
 * 🟢 適用   一組同型的插槽（EXPR0、EXPR1…），只差數量
 * 🔴 不適用 每項一組【多個】欄位（`cpp_func_def` 的 TYPE_{i}＋PARAM_{i}）
 *          → 那是同一個宣告的另一種形狀，這一版不處理
 * 🔴 不適用 `childrenAsField`（全部擠進一個文字欄位）
 *          → `types.ts` 明說它是**兩種不同的形態**
 * ```
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

function setMinusState(block: any, isAtMin: boolean): void {
  const f = block.getField('MINUS_BTN')
  if (f) f.setValue(isAtMin ? MINUS_DISABLED_IMG : MINUS_IMG)
}

export interface VariadicSpec {
  /** 插槽名的樣板，`{i}` 會換成序號（來自 `dynamicRules.inputPattern`） */
  inputPattern: string
  /** 第一個插槽前面的標籤（Blockly 訊息鍵，例如 `U_PRINT_MSG`） */
  labelKey?: string
  /** 訊息鍵查不到時的字（**沒有它就不放標籤**，不猜一個） */
  labelFallback?: string
  /** 插槽的型別檢查 */
  check?: string
  colour: string | number
  tooltipKey?: string
  tooltipFallback?: string
  inputsInline?: boolean
  previousStatement?: string | null
  nextStatement?: string | null
  /** 這顆是運算式（有 output）而不是語句 */
  output?: string
  /**
   * 第一個插槽**前面**的一個欄位（spec 168）。
   *
   * 🔴 第二個語言的呼叫積木需要它：`呼叫 [名字下拉] (引數…)` ——
   * 標籤、下拉、然後才是可變的插槽。
   *
   * ⚠️ 在此之前這個建構子只做得出「標籤 ＋ 插槽」，於是任何
   * **帶前置欄位的可變參數積木**都只能回去寫命令式定義
   * ——而那正是 vision 那 19 筆的來源。
   *
   * > **一個建構子表達不出來的形狀，會變成一筆新的雙重真相。**
   */
  leadingField?: { type: string; name: string; source?: string; options?: unknown }
  /**
   * 最少幾格（預設 1）。
   *
   * 🔴 **第二個語言的呼叫積木要 0**（使用者 2026-08-21：「初始參數量應該是零才對」）
   * ——`reset()` 是常態，而一顆開起來就掛著一個空插槽的呼叫積木，
   * 讀起來像「這裡少了一個東西」。
   *
   * ⚠️ 而輸出那顆要 1：`print()` 印一個空行是合法的，**而它不是學生想做的事**。
   * > **最少幾格是一個教學決定，不是一個技術預設。**
   */
  minCount?: number
}

/** `EXPR{i}` → `EXPR3` */
function inputName(pattern: string, i: number): string {
  return pattern.replace('{i}', String(i))
}

/**
 * 建一顆可變參數的積木定義。
 *
 * ⚠️ **`saveExtraState` 的格式必須與命令式那版一字不差**（`{ itemCount }`）
 * ——舊存檔裡就是那個形狀，換一個鍵名等於讓使用者的檔案打不開。
 */
export function defineVariadicBlock(type: string, spec: VariadicSpec): void {
  const msg = Blockly.Msg as Record<string, string>
  Blockly.Blocks[type] = {
    itemCount_: spec.minCount ?? 1,
    init: function (this: any) {
      const min = spec.minCount ?? 1
      this.itemCount_ = 0
      // 🔴 **標籤與前置欄位放在自己的啞輸入上**（spec 169）。
      //
      // ⚠️ 第一版把它們掛在**第一個值插槽**上，而那有兩個後果：
      //   ① 最少 0 格的積木（`reset()`）沒有第一個插槽 → **標籤整個不見**
      //   ② 版面與命令式那些積木不同（它們用 `appendDummyInput('LABEL')`）
      //      → 比對護欄永遠報 differ，那批命令式定義因此退不了場
      //
      // > **一個「把標籤掛在第一個資料上」的版面，在資料可以是零個的時候就崩了。**
      const head = this.appendDummyInput('HEAD')
      const label = spec.labelKey ? (msg[spec.labelKey] || spec.labelFallback) : spec.labelFallback
      if (label) head.appendField(label)
      if (spec.leadingField) {
        // 用 Blockly 的 JSON 欄位工廠——**不要自己 new 一個具體的欄位類別**，
        // 那樣自訂欄位（`field_dynamic_dropdown`）就接不進來。
        const f = Blockly.fieldRegistry.fromJson(spec.leadingField as never)
        if (f) head.appendField(f, spec.leadingField.name)
      }
      this.appendDummyInput('TAIL')
        .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plus_()))
        .appendField(new Blockly.FieldImage(MINUS_DISABLED_IMG, 20, 20, '-', () => this.minus_()), 'MINUS_BTN')
      if (spec.inputsInline !== false) this.setInputsInline(true)
      if (spec.output !== undefined) this.setOutput(true, spec.output)
      else {
        this.setPreviousStatement(true, spec.previousStatement ?? 'Statement')
        this.setNextStatement(true, spec.nextStatement ?? 'Statement')
      }
      this.setColour(spec.colour)
      const tip = spec.tooltipKey ? (msg[spec.tooltipKey] || spec.tooltipFallback) : spec.tooltipFallback
      if (tip) this.setTooltip(tip)
      for (let i = 0; i < min; i++) this.plus_()
      setMinusState(this, this.itemCount_ <= min)
    },
    plus_: function (this: any) {
      const n = inputName(spec.inputPattern, this.itemCount_)
      const inp = this.appendValueInput(n)
      if (spec.check) inp.setCheck(spec.check)
      this.moveInputBefore(n, 'TAIL')
      this.itemCount_++
      setMinusState(this, false)
    },
    minus_: function (this: any) {
      if (this.itemCount_ <= (spec.minCount ?? 1)) return
      this.itemCount_--
      this.removeInput(inputName(spec.inputPattern, this.itemCount_))
      setMinusState(this, this.itemCount_ <= (spec.minCount ?? 1))
    },
    saveExtraState: function (this: any) {
      return { itemCount: this.itemCount_ }
    },
    loadExtraState: function (this: any, state: { itemCount?: number }) {
      const count = state?.itemCount ?? (spec.minCount ?? 1)
      while (this.itemCount_ < count) this.plus_()
    },
  }
}

/**
 * **把可變插槽【接】到一顆已經 `jsonInit` 過的積木上**——而不是從零建整顆。
 *
 * ## 為什麼需要第二種模式（2026-08-22）
 *
 * `defineVariadicBlock` 從零建：`HEAD`（一個標籤 ＋ 一個前置**欄位**）、
 * 插槽、`TAIL`。它表達不了「**插槽在前**」的形狀，而
 * `python_method_call` 正是那一種：`對 [接收者] 做 [方法名] (引數…)`。
 *
 * 症狀是**瀏覽器裡載入積木狀態時整個工作區載不進去**：
 *
 * ```
 * MissingConnection: The block "python_method_call" is missing a(n) OBJ connection
 * ```
 *
 * ——`args0` 裡宣告的 `OBJ` 與 `METHOD` **兩個都被丟掉了**，
 * 而 `METHOD` 被丟掉時甚至不報錯（`getFieldValue` 靜靜回 `null`）。
 *
 * 🔴 這個模組自己的檔頭早就寫過這條：
 *
 * > **一個「從零建整顆」的建構子，遇到「只有一部分是動態的」積木時，
 * > 唯一的出路是把靜態的部分也吞進去——而那正是它會弄丟欄位的原因。**
 *
 * 那句話在 2026-08-21 是對「未來」說的；2026-08-22 它兌現了。
 *
 * ⚠️ **兩種模式的判準是「宣告裡有沒有靜態的部分」**（`args0` 空不空），
 * 不是「這顆積木叫什麼」。
 */
export function attachVariadic(type: string, spec: VariadicSpec): void {
  const proto = Blockly.Blocks[type] as any
  if (!proto) throw new Error(`attachVariadic：積木型別 ${type} 還沒被定義——順序反了`)
  const baseInit = proto.init
  const min = spec.minCount ?? 1

  proto.itemCount_ = 0
  proto.init = function (this: any): void {
    baseInit.call(this)
    this.itemCount_ = 0
    this.appendDummyInput('TAIL')
      .appendField(new Blockly.FieldImage(PLUS_IMG, 20, 20, '+', () => this.plus_()))
      .appendField(new Blockly.FieldImage(MINUS_DISABLED_IMG, 20, 20, '-', () => this.minus_()), 'MINUS_BTN')
    for (let i = 0; i < min; i++) this.plus_()
    setMinusState(this, this.itemCount_ <= min)
  }

  proto.plus_ = function (this: any): void {
    const n = inputName(spec.inputPattern, this.itemCount_)
    const inp = this.appendValueInput(n)
    if (spec.check) inp.setCheck(spec.check)
    this.moveInputBefore(n, 'TAIL')
    this.itemCount_++
    setMinusState(this, false)
  }

  proto.minus_ = function (this: any): void {
    if (this.itemCount_ <= min) return
    this.itemCount_--
    this.removeInput(inputName(spec.inputPattern, this.itemCount_))
    setMinusState(this, this.itemCount_ <= min)
  }

  // ⚠️ **格式與從零建的那一種一字不差**（`{ itemCount }`）——存檔契約。
  proto.saveExtraState = function (this: any): { itemCount: number } {
    return { itemCount: this.itemCount_ }
  }
  proto.loadExtraState = function (this: any, state: { itemCount?: number }): void {
    const count = state?.itemCount ?? min
    while (this.itemCount_ < count) this.plus_()
    while (this.itemCount_ > count) this.minus_()
  }
}
