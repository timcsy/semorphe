/**
 * **執行期停下來時，說給使用者聽的那一句。**
 *
 * ## 它從哪來
 *
 * 2026-08-15 的探針量了第一課的學生會犯的 9 種錯。放行的兩種，
 * 學生在輸出區看到的是：
 *
 * ```
 * RUNTIME_ERR_UNDECLARED_VAR: {"%1":"Cout"}
 * ```
 *
 * 根因是 `execution-controller` 直接推 `RuntimeError.message`，而那個欄位
 * （`interpreter/errors.ts`）是**身分 ＋ JSON 化的參數**——一個
 * **給開發者看的湊合字串**，從來不是給使用者的。
 *
 * 🔴 **而這是一天前才修過的病**（`monaco-panel` 查 `window.Blockly?.Msg`
 * 永遠走 fallback，spec `121`）。同一個形狀，換了一個顯示點。
 *
 * ## 為什麼是這個檔，而不是在控制器裡查表
 *
 * 三個顯示點（執行完、單步、除錯）**各查一次表，就是三個會忘記的地方**。
 * 收成一個具名的函式之後，第四十四條護欄才有一個**可以錨的顯示邊界**
 * ——而它的第二支測試正是「不得有人繞過這個函式」。
 *
 * > **一個缺陷要能被護欄看見，它得先有一個名字。**
 */
import { formatMessage } from '../i18n/messages'

/** 查不到文案時的那一句。⚠️ **它是唯一不查表的一句**，所以必須存在。 */
const FALLBACK_ZH = '程式停下來了，而我說不出是為什麼——這是系統的問題，不是你的。'

/**
 * 把一個執行期停止原因，變成**一句人看得懂的話**。
 *
 * ⚠️ **查不到文案時退回一句通用的話，不退回代號**——退回代號正是
 * `i18n/messages.ts` 檔頭那個「靜默降級」缺陷本身。
 */
export function describeRuntimeStop(
  i18nKey: string,
  params: Record<string, string> = {},
): string {
  return formatMessage(i18nKey, params) ?? formatMessage('RUNTIME_ERR_FALLBACK') ?? FALLBACK_ZH
}
