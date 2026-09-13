/**
 * **動態下拉來源的登記處**——第 N 個同形狀的登記處（見 `concepts/宣告登記處.md`）。
 *
 * ## 為什麼它從 `ui/dynamic-dropdown-field.ts` 搬出來（2026-08-24）
 *
 * 那個檔裡本來住著兩個東西：
 *
 * ```
 * declareDropdownSource / dropdownSourceNames   一張 Map——【與 Blockly 無關】
 * registerDynamicDropdownField                  一個 Blockly 欄位——當然要 Blockly
 * ```
 *
 * 而語言套件只需要前者。它們卻因此 import 了整個視圖層：
 * `languages/<lang>/pack.ts` → `ui/dynamic-dropdown-field` → `blockly` → `jsdom`。
 *
 * > **一個登記處與一個使用它的欄位住在同一個檔案裡，
 * > 就等於要求每一個登記者都依賴那個欄位的實作。**
 *
 * 症狀是在 Node 裡才現形的（`examples/bring-your-own-view/`）：出貨的核心
 * 拖著 Blockly ＋ jsdom，而那個宿主連 DOM 都沒有。
 */
/**
 * **這顆下拉此刻長在哪裡**——用純字串描述，不帶任何 Blockly 型別。
 *
 * ## 為什麼下拉需要知道位置（2026-08-26）
 *
 * `block-registrar.ts` 上頭那段註解寫著：
 *
 * > **兩個下拉長得一樣，不代表它們問的是同一個問題。**
 *
 * 當時那個區別住在**積木型別**裡：`cpp_var_ref` 是讀（變數 ∪ 板子常數），
 * 而 `cpp_var_assign` 的 `NAME` 是寫（只有變數，否則學生選得到 `HIGH = 5`）。
 *
 * 🔴 **左值接點化把那兩個型別合成了一個**：賦值的左邊現在裝的**就是一顆
 * `cpp_var_ref`**。於是那個區別失去了它原本的載體——
 *
 * > **一個靠「你是哪一種積木」成立的區別，
 * > 在那兩種積木合而為一的那天會安靜地消失。**
 *
 * 它不會拋錯，也不會讓任何單元測試變紅：症狀只是下拉多了幾個名字。
 * （抓到它的是 e2e——`npm test` 5749 支全綠。）
 *
 * → 區別搬到**位置**：問「我坐的這一格，是不是宣告過的寫入目標」。
 *   而「哪一格是寫入目標」由元件自己宣告（`traits.writesTo`），不是猜的。
 */
export interface DropdownContext {
  /** 這顆積木自己的型別 */
  blockType?: string
  /** 它接在誰身上 */
  parentBlockType?: string
  /** 接在對方的哪一格（Blockly 的 input 名，例如 `TARGET`） */
  parentInputName?: string
}

type DropdownOptions = (ctx?: DropdownContext) => Array<[string, string]>

const sources = new Map<string, DropdownOptions>()

/** 語言套件／膠囊登記一個具名的下拉來源 */
export function declareDropdownSource(name: string, options: DropdownOptions): void {
  sources.set(name, options)
}

/** 這個名字登記過嗎——查不到回 `undefined`，**不猜一份空清單** */
export function dropdownSource(name: string): DropdownOptions | undefined {
  return sources.get(name)
}

/** 全部登記過的名字（護欄與比對器用） */
export function dropdownSourceNames(): string[] {
  return [...sources.keys()]
}
