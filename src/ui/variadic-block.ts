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
 * 症狀在 spec 160 具體出現過：`python_print` 宣告了 `dynamicRules`，
 * 而瀏覽器報 `The block "python_print" is missing a(n) EXPR0 connection`
 * ——**宣告有了，沒有人照著它建那些 input**。
 *
 * > `vision` 逐字：「它等的是 Python 的第一顆【積木】」——而它等到了。
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
    itemCount_: 1,
    init: function (this: any) {
      this.itemCount_ = 1
      const first = this.appendValueInput(inputName(spec.inputPattern, 0))
      if (spec.check) first.setCheck(spec.check)
      const label = spec.labelKey ? (msg[spec.labelKey] || spec.labelFallback) : spec.labelFallback
      if (label) first.appendField(label)
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
      if (this.itemCount_ <= 1) return
      this.itemCount_--
      this.removeInput(inputName(spec.inputPattern, this.itemCount_))
      setMinusState(this, this.itemCount_ <= 1)
    },
    saveExtraState: function (this: any) {
      return { itemCount: this.itemCount_ }
    },
    loadExtraState: function (this: any, state: { itemCount?: number }) {
      const count = state?.itemCount ?? 1
      while (this.itemCount_ < count) this.plus_()
    },
  }
}
