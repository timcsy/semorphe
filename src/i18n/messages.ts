/**
 * **面板中立的訊息查表。**
 *
 * ## 它從哪來
 *
 * 2026-08-14 的 e2e 抓到：程式碼面板顯示給使用者的訊息是
 * **`DIAG_MISSING_CONDITION` 這串原始代號**，而不是「缺少條件」。
 *
 * 根因是 `monaco-panel` 查的是 `window.Blockly?.Msg`——而 `Blockly.Msg` 是
 * **Blockly 模組上的物件**（`i18n/loader.ts` 的 `injectToBlocklyMsg` 寫進去的那個），
 * `window.Blockly` 在打包後的 app 裡根本不存在。
 *
 * ```
 * 積木面板   import * as Blockly → Blockly.Msg[key]        ✅ 查得到
 * 程式碼面板 window.Blockly?.Msg?.[key] ?? key             🔴 永遠走 fallback
 * ```
 *
 * ⚠️ **而那個 `?? key` 讓它看起來像正常運作**——一則「訊息」出現了，
 * 只是內容是代號。`experience` 的「靜默降級」那一族。
 *
 * ## 為什麼不讓程式碼面板也 import Blockly
 *
 * 那會讓**程式碼視圖依賴積木函式庫**。訊息查表與積木無關，
 * 它該住在 i18n 這一側，而兩個面板都只是它的消費者。
 *
 * ## 為什麼 `formatMessage` 查不到時回 `null` 而不是回 key
 *
 * 回 key 就是上面那個缺陷本身。**回 `null` 逼呼叫端面對「這裡沒有文案」**，
 * 而完備性由 `tests/integration/audit-diagnostic-labels.test.ts`（第四十二條護欄）
 * 在開發期保證——執行期不需要一個假裝正常的退路。
 */

let current: Record<string, string> = {}

/** 由 `LocaleLoader` 在載入語言包時呼叫。**同一個來源，兩個消費者。** */
export function setMessages(messages: Record<string, string>): void {
  current = { ...current, ...messages }
}

/** 這個 key 有沒有文案。護欄與面板都用它。 */
export function hasMessage(key: string): boolean {
  return key in current
}

/**
 * 組一則訊息。查不到回 `null`——**不做靜默降級**。
 *
 * 佔位符是 `{name}`，刻意與 Blockly 的 `%1` 不同：
 * 診斷訊息的參數**有名字**（`inputName`／`index`），
 * 而位置參數會讓「第二個是什麼」變成一個要去對照的問題。
 *
 * ## ⚠️ 而它同時吃 `%N`，那不是改變主張，是讓路
 *
 * 2026-08-15 查證：216 個鍵裡含 `%` 的有 17 個，**其中 11 個是
 * `CPP_*_MSG0`——餵給 Blockly 的積木文案，`%1` 是【Blockly 的格式】**。
 * 把它們改成 `{name}` 積木就長不出來。
 *
 * ```
 * 選擇權   一半在我們手上（診斷文案）   → {name}
 *          一半在 Blockly 手上（積木）  → %N，改不了
 * ```
 *
 * 所以「統一」在全域上不可能，而執行期文案（`RUNTIME_ERR_*`）歷史上跟了
 * Blockly 那一套。**這裡吃兩套，代價是一個 regex；而新文案一律用 `{name}`**
 * ——`%N` 只是為既有文案讓路，兩套**不等價**。
 */
export function formatMessage(
  key: string,
  params: Record<string, string | number> = {},
): string | null {
  const template = current[key]
  if (template === undefined) return null
  return template
    .replace(/\{(\w+)\}/g, (whole, name: string) =>
      name in params ? String(params[name]) : whole,
    )
    .replace(/%(\d+)/g, (whole, n: string) =>
      `%${n}` in params ? String(params[`%${n}`]) : whole,
    )
}

/** 測試用：清空。產品程式碼不該呼叫它。 */
export function resetMessages(): void {
  current = {}
}
