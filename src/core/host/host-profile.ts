/**
 * **這個宿主有什麼、沒有什麼** —— 一份看得完的宣告。
 *
 * ## 為什麼是一份宣告，不是散落的 `if`
 *
 * `component-generate` skill 記過同形的病：
 *
 * > **一張「加一顆元件要做什麼」的清單，如果只存在於七條護欄的失敗訊息裡，
 * > 那麼每一個新來的人都要把那七條各撞一次才學得會。**
 *
 * 同一句話換個位置：
 *
 * > **一份「這個宿主缺什麼」的清單，如果只存在於各處的 `if` 裡，
 * > 那麼每一個新宿主都要把那些 `if` 各撞一次才學得會。**
 *
 * ## 🔴 而 `id` 不得拿來做行為分支
 *
 * 一旦有人寫 `if (profile.id === 'vscode')`，這份宣告就**退化成一個標籤**
 * ——而能力清單不再是真相，因為真相散回去了。
 *
 * ⚠️ 由 `tests/integration/host-profile-no-branch.test.ts` 釘住。
 */
import type { CodeView } from './code-view'
import type { SavedState, LoadOutcome } from '../storage'

/**
 * 存檔服務這個角色。
 *
 * ⚠️ 網頁版的實作**就是今天那個**；而「檔案才是真相」的宿主注入一個
 * **不記文件內容**的實作——理由見 `specs/140-app-in-host/contracts/code-view.md` 第五節。
 */
export interface StorageLike {
  save(state: Partial<SavedState>): boolean
  loadOutcome(): LoadOutcome

  /**
   * 匯入匯出——🔴 **它是 `fileButtons` 那個能力的一部分，不是「存檔」的一部分**。
   *
   * ⚠️ 所以它是**可選**的：一個「檔案由 IDE 管」的宿主沒有這一組，
   * 而那不是缺陷，是它本來就不該有。
   *
   * 🟢 而「可選 ＋ 理由」是這一輪的統一形狀——見 `code-view.ts` 的 `absentReasons`。
   */
  exportToBlob?(state: SavedState): Blob
  downloadBlob?(blob: Blob, filename: string): void
  importFromJSON?(json: string): SavedState | null

  /** ⚠️ 只給測試用：看儲存體裡實際留下了什麼。 */
  dumpForTest?(): unknown
}

/** 這個宿主要不要建這些介面元件。🔴 關掉 ＝ **不建**，不是建了再藏起來（FR-006）。 */
export interface HostFeatures {
  /** 開檔／存檔／匯入匯出 */
  fileButtons: boolean
  /** 行動版的分頁列與選單 */
  mobileLayout: boolean
  /** 輔助輸入鍵盤（它需要底層編輯器） */
  codeKeyboard: boolean
}

export type HostFeatureName = keyof HostFeatures

export interface HostProfile {
  /**
   * 🔴 **僅供診斷。不得拿來做行為分支。**
   *
   * 要問「這個宿主有沒有 X」，問 `features` 或 `codeView` 的可選方法
   * ——**那才是真相**。
   */
  readonly id: string
  createCodeView(container: HTMLElement): CodeView
  createStorage(): StorageLike
  readonly features: HostFeatures
  /**
   * 🔴 **關掉的每一項都要有理由。**
   *
   * ⚠️ 鍵必須與 `features` 裡為 `false` 的那些**一模一樣**
   * ——多一個是說謊，少一個是遺漏。
   */
  readonly featureReasons: Partial<Record<HostFeatureName, string>>
}
