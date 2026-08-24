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
type DropdownOptions = () => Array<[string, string]>

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
