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
import type { ControlSurfaces } from './controls'
import type { UnderstandingLayer } from '../view-host'

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
  /**
   * 面板裡要不要留一格給程式碼編輯器。
   *
   * 🔴 **`false` 的意思不是「藏起來」，是「那一格不存在」** ——
   * 一個把文字編輯交給宿主的面板，留一塊空白給不存在的編輯器
   * 就是把版面浪費掉。
   */
  codeEditorPane: boolean
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

  /**
   * 這個宿主的「網址查詢字串」——`?lesson=…` 從這裡進來。
   *
   * 🔴 **核心不碰 `location`**（四項獨立性）：網頁宿主餵 `window.location.search`，
   * 而 VSCode／測試餵 `undefined` 或一個合成的字串。
   *
   * ⚠️ **它是選填的，而 `undefined` 與 `''` 意思相同**（沒有選課）
   * ——不是「這個宿主壞了」。VSCode 那側之後要選課的話，
   * 它的入口是一個指令而不是網址，那時這一格仍然是 `undefined`。
   */
  readonly querySearch?: string

  /**
   * 🔴 **每一種控制項投影到哪個表面**——三列，一個宿主一張。
   *
   * ⚠️ 這一格取代了原本的 `features.statusBar`（2026-08-25 同日）：
   * 「面板要不要畫狀態列」與「控制項投影到哪」**是同一件事**，
   * 而留成兩份宣告，它們遲早會互相矛盾。
   *
   * ⚠️ 投影到 `host*` 的每一種，宿主那側都背一個**接手的義務**
   * ——由 `tests/integration/audit-status-bar-owner.test.ts` 對釘。
   * 症狀不對釘的話是「面板那顆不見了、宿主那顆沒出現」，
   * 而使用者讀到的不是「少一顆按鈕」，是「**壞了**」。
   */
  readonly controlSurfaces: ControlSurfaces

  /**
   * **這個視窗畫哪幾層**——不填 ＝ `features` 允許的都畫。
   *
   * ## 🔴 為什麼是「視窗」不是「宿主」
   *
   * 2026-09-01，使用者：「我原本的期待是能不能**把面板都獨立出來**？」
   *
   * 在 VSCode 裡，程式碼是 IDE 的編輯器、主控台是 IDE 的終端機、變數是
   * IDE 的一個視圖——**只有積木與流程還擠在同一個 webview 裡**，
   * 由我們自己畫一張 grid、自己畫分隔線、自己說「這是四格」。
   *
   * > **一個宿主已經有版面引擎的時候，我們再帶一個進去，
   * > 使用者要學的就是【兩套】——而且那兩套會互相說對方的壞話。**
   *
   * 🟢 於是一個 webview 只畫一層，版面交還給 IDE：拖到側邊、拆成兩欄、
   * 用它自己的分隔線調整——**全部免費，而且與使用者其他的面板一致**。
   *
   * ## ⚠️ 它為什麼可以這麼便宜
   *
   * 因為**真相是文字**（網頁版存的是 `code`，`blocklyState` 只是快取；
   * 這個宿主是那份文件）。每個面板各自 `project` 同一份文字，
   * 而 P1 說投影是純函數——**所以每個面板要的協定都一樣：文字進、編輯出**。
   *
   * > **一個必須被餵才畫得出來的視圖，它不是在投影。**
   *
   * ⚠️ 對照組就在這個 repo 裡：`變數` 視圖是被餵的，而**餵它的面板關掉之後
   * 沒有任何人清它**——它會停在最後一筆，看起來完全正常。
   */
  readonly layers?: readonly UnderstandingLayer[]
}
