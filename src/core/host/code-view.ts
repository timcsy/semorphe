/**
 * **程式碼視圖這個【角色】** —— 而應用只認識角色，不認識任何一個具體的編輯器。
 *
 * ## 它從哪來
 *
 * `ui/app.ts` 有 22 處直接呼叫一個具體的編輯器面板，`ui/app-shell.ts` 8 處，
 * `ui/execution-controller.ts` 2 處。而使用者要「擴充裡跑的就是網頁版」
 * ——那要求兩邊**共用同一份組裝**。
 *
 * > **一次抽象如果沒有換掉任何資料，它換掉的是【誰有權知道什麼】。**
 *
 * ## 🔴 必要與可選的分界，而它是刻意的
 *
 * ```
 * 必要   文字內容 ＋ 高亮游標 ＋ 生命週期   —— 每個宿主都要有，否則應用跑不起來
 * 可選   版面相關（重排／行動版／底層編輯器）—— 編輯器不歸我們管的宿主【沒有】
 * ```
 *
 * ⚠️ **可選的那一組【不可以用空實作】。** 專案明令（`component-generate` skill 步驟五）：
 *
 * > **宣告性概念不要寫 noop。顯式的空與遺漏的空要分得出來，
 * > 而一個 noop 函式兩者長得一樣。**
 *
 * 🟢 所以缺席由**型別**表達（可選欄位），而**理由**由 `absentReasons` 表達
 * ——⚠️ 兩者由 `tests/integration/host-code-view-contract.test.ts` 釘在一起：
 * **多一個是說謊，少一個是遺漏。**
 *
 * 呼叫端寫 `codeView.relayout?.()` —— 🟢 **那不是防禦性程式碼，
 * 是讀得出意圖的程式碼**：這一格本來就可能不存在。
 */
import type { SemanticBus } from '../semantic-bus'
import type { ExecutionAtNodeEvent, SemanticUpdateEvent } from '../view-host'

/**
 * 高亮的來由——決定顏色與優先序。
 *
 * ⚠️ **只有兩種**，而執行高亮不在這裡：它走 `onExecutionAtNode`
 * ——🔴 因為「執行到哪個節點」是**唯一真實**，而高亮是它的投影，不是一個命令
 * （`core/view-host.ts:94`）。
 */
export type HighlightVariant = 'block-to-code' | 'code-to-block'

/** 可選能力的名字。⚠️ 它同時是 `absentReasons` 的鍵，兩邊必須對得上。 */
export type OptionalCodeViewCapability =
  | 'relayout'
  | 'applyMobileOptions'
  | 'applyDesktopOptions'
  | 'getEditor'

export interface CodeView {
  // ─── A：文字內容 ───

  /**
   * 目前的程式碼。
   *
   * 🔴 **同步。** 呼叫點有六處，全部是同步用法。
   * ⚠️ 文字的真相若在另一個行程，實作**必須保一份本地鏡像**
   * ——而鏡像過期的處置見 `specs/140-app-in-host/contracts/code-view.md` 第三節。
   */
  getCode(): string
  setCode(code: string): void
  /** 換內容但盡量不動游標。`linesDelta` 是行數的變化量。 */
  setCodePreserveCursor(code: string, linesDelta: number): void
  onChange(callback: (code: string) => void): void

  // ─── B：高亮與游標 ───

  /** ⚠️ 行號是 **1-based**（沿用今天的呼叫端）。 */
  addHighlight(startLine: number, endLine: number, variant: HighlightVariant): void
  clearHighlight(): void
  /** 取消「還沒送出的那一次高亮」——避免游標移動與點積木互相蓋掉。 */
  dismissPendingHighlight(): void
  onCursorChange(callback: (line: number) => void): void

  // ─── D：生命週期 ───

  connectBus(bus: SemanticBus): void
  dispose(): void
  onSemanticUpdate(event: SemanticUpdateEvent): void
  onExecutionAtNode?(event: ExecutionAtNodeEvent): void

  // ─── C：可選——**沒有的要說得出為什麼** ───

  /** 版面變了要重排。⚠️ 編輯器不歸我們管的宿主沒有這一格。 */
  relayout?(): void
  applyMobileOptions?(): void
  applyDesktopOptions?(): void
  /** 把底層編輯器交出去（輔助輸入鍵盤要用）。 */
  getEditor?(): unknown | null

  /**
   * 🔴 **這個實作【沒有】哪些可選能力，以及為什麼。**
   *
   * ⚠️ 鍵必須與「沒實作的可選方法」**一模一樣**：
   * **多一個是說謊（宣稱缺席而其實有），少一個是遺漏（缺席而沒說）。**
   */
  readonly absentReasons: Partial<Record<OptionalCodeViewCapability, string>>
}

/** 可選能力的完整清單——測試拿它逐一比對。 */
export const OPTIONAL_CODE_VIEW_CAPABILITIES: readonly OptionalCodeViewCapability[] = [
  'relayout',
  'applyMobileOptions',
  'applyDesktopOptions',
  'getEditor',
]
