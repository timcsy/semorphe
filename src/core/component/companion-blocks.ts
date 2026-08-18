/**
 * 「拉出一顆積木時，順帶長出另一顆」的宣告登記處。
 *
 * ## 🔴 為什麼需要它
 *
 * 使用者拍板的第②項（階段 6.16）逐字：**`pinMode` 由「自動長出一顆
 * 【看得見的】積木」負責**。
 *
 * 而「看得見」是重點。另一條路是讓接線積木自己產出兩行程式碼
 * （宣告 ＋ `pinMode`）——⚠️ 那條路查證過**做不到**：鷹架機制只認得它自己的
 * 四段（imports／preamble／entryPoint／epilogue），而 `pinMode` 要落在使用者
 * **自己的 `setup()`** 裡，那對鷹架是一個普通的頂層函式。
 *
 * > **一顆概念如果要在兩個位置產出程式碼，先問「第二個位置能不能是一顆積木」
 * > ——看得見的東西比藏在產生器裡的東西好改。**
 *
 * 🟢 而它同時讓五路保持乾淨：產生器完全不必知道這件事。
 *
 * ## 形狀：核心給機制、套件給資料
 *
 * 與 `post-processors.ts`／`comment-syntax.ts`／`language-executors.ts` 同一個形狀。
 * ⚠️ 表是空的——沒有套件時什麼都不長，**而那是正確的中立行為**。
 *
 * ## 🔴 而它【只在使用者親手拉的時候】長
 *
 * 反序列化（程式碼→積木、還原、載入存檔）**一律不長**——那些來源的
 * `pinMode` 本來就在原文裡，再長一顆就是憑空多出來的一行。
 * ⚠️ 這一條漏掉的症狀是：貼一次程式碼，`setup` 裡的 `pinMode` 就多一份。
 */

import { registeredComponents } from './registry'

/** 一筆「誰帶誰」的宣告。 */
export interface CompanionSpec {
  /** 觸發的積木型別（使用者從工具箱拉出來的那顆） */
  trigger: string
  /** 要長出來的積木型別 */
  companion: string
  /**
   * 把觸發積木的某個**欄位值**，變成伴生積木某個輸入上的一顆參照積木。
   *
   * ⚠️ `refBlock`／`refField` 也在這裡宣告——🔴 **核心不得認得任何積木型別**，
   * 寫進 UI 檔的話就近性護欄會兩個方向都報，而它報得對。
   */
  bind: { fromField: string; toInput: string; refBlock: string; refField: string }
  /** 伴生積木其他輸入要填的常數積木。例：`MODE` ← 一顆值為 `OUTPUT` 的常數。 */
  constants: Record<string, { blockType: string; field: string; value: string }>
  /**
   * 伴生積木要放進哪個函式的主體。**找不到就不長。**
   *
   * ⚠️ 連「函式定義積木長什麼樣」都由宣告帶——同上，核心不認得任何型別。
   */
  intoFunction: { blockType: string; nameField: string; bodyInput: string; name: string }
}

/**
 * 🔴 **沒有登錄呼叫**——宣告住在膠囊的 `component.json` 的 `companion` 欄，
 * 而這裡直接去登錄表裡找。
 *
 * 判準是專案付過學費的那一條（2026-08-10，第三顆膠囊整批回退兩次）：
 *
 * > **把資料做成登錄呼叫，等於替它發明一個會忘記呼叫的時序。**
 * > 這個東西有沒有人要「查」它？有 → 登錄。沒有（一整筆資料）→ 直讀。
 *
 * 這裡是後者：一整筆資料，而 UI 只在使用者拉積木的那一刻問一次。
 */
export function companionFor(blockType: string): CompanionSpec | undefined {
  for (const c of registeredComponents()) {
    const spec = (c.manifest as { companion?: CompanionSpec }).companion
    if (spec?.trigger === blockType) return spec
  }
  return undefined
}
