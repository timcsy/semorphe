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
import type { SyncPhase } from '../sync-coordinator'
import type { ControlState, ControlInvoke } from './controls'

/**
 * 高亮的來由——決定顏色與優先序。
 *
 * ⚠️ **只有兩種**，而執行高亮不在這裡：它走 `onExecutionAtNode`
 * ——🔴 因為「執行到哪個節點」是**唯一真實**，而高亮是它的投影，不是一個命令
 * （`core/view-host.ts:94`）。
 */
export type HighlightVariant = 'block-to-code' | 'code-to-block'

/**
 * 宿主那側能下的同步指令。
 *
 * 🔴 **`use` 不帶一份來源清單**——主行程不認識任何一個具體的面板，
 * 它只說「以這個 viewId 為準」，而有哪些 viewId 由 `viewsWith('editable')` 決定。
 */
export interface HostSyncCommand {
  action: 'pause' | 'resume' | 'use'
  viewId?: string
}

/** 可選能力的名字。⚠️ 它同時是 `absentReasons` 的鍵，兩邊必須對得上。 */
export type OptionalCodeViewCapability =
  | 'relayout'
  | 'applyMobileOptions'
  | 'applyDesktopOptions'
  | 'getEditor'

export interface CodeView {
  /**
   * **文字層的還原／重做**——⚠️ **選用**。
   *
   * 🔴 它與「積木的還原」「語義樹的還原」**不是同一種一步**：
   *
   * ```
   * 程式碼   一次打字（字元群組）——編輯器自己的顆粒度最好
   * 積木     一次工作區事件
   * 語義樹   一次樹的改動（而流程的版面位移根本不在樹裡）
   * ```
   *
   * > **三份堆疊沒辦法真的合成一份，因為它們的「一步」不是同一個東西。
   * > 能共用的是那一對【按鈕】，不是底下的歷史。**
   *
   * ⚠️ 交不出來的宿主（文字由 IDE 管）就不實作——那時那一步交給宿主自己。
   */
  undo?(): void
  redo?(): void
  // ─── A：文字內容 ───

  /**
   * 目前的程式碼。
   *
   * 🔴 **同步。** 呼叫點有六處，全部是同步用法。
   * ⚠️ 文字的真相若在另一個行程，實作**必須保一份本地鏡像**
   * ——而鏡像過期的處置見 `specs/140-app-in-host/contracts/code-view.md` 第三節。
   */
  /**
   * **這個視圖的內容來自外部文件嗎？**
   *
   * 🔴 `true` ⟹ **開機時不得由我們產生內容** ——那份文件是權威，而它
   * **晚到**（宿主的 `document` 訊息是一次 postMessage 往返）。
   *
   * ## 它從哪來
   *
   * 2026-08-31 使用者回報：「我用 Arduino IDE 把 semorphe 開起來，
   * 原本的 `setup` 和 `loop` 會被 C++ 預設骨架覆蓋」。
   *
   * 鏈是：`restoreState()` 沒有存檔 → 走開機同步 → 從空工作區產生
   * `using namespace std; int main(){}` → 寫進 `codeView` →
   * 在擴充裡那是 `setCode()`「算出範圍 → 交給宿主寫回」→ **蓋掉 .ino**。
   *
   * ⚠️ 而 `applyHostConfig` 早就寫著同一族的教訓：
   * > 「一個『換設定』的動作如果順手寫了檔案，那麼在還沒讀到檔案之前換設定，
   * >  就會把檔案寫成還沒讀到的樣子。」
   *
   * **這一格把那句話變成一個視圖答得出來的問題**，而不是一段
   * `if (host === 'vscode')`——那會讓宣告退化成標籤（第六十三條護欄的判準）。
   *
   * 🟢 網頁版是 `undefined`／`false`：那裡沒有檔案，開機產生骨架**是對的**
   * （它修掉了「第一次打開畫面是空的」）。
   */
  readonly documentBacked?: boolean
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

  // ─── E：宿主橋——**只有「面板自己不畫狀態列」的宿主需要** ───

  /**
   * 把同步三態交給宿主的狀態列。
   *
   * 🔴 **它與 `HostFeatures.statusBar` 是同一件事的兩端**——面板不畫，
   * 就一定要有人畫。⚠️ 兩端由 `tests/integration/audit-status-bar-owner.test.ts`
   * **對釘**，否則一個 `statusBar: false` 的新宿主會讓三態**安靜地消失**
   * ——而「安靜」正是最糟的那一種，使用者只會覺得同步壞了。
   *
   * `detail` 是狀態列本來那一行的其餘部分（語言｜風格｜積木風格｜主題｜語系）。
   * 🔴 **常駐顯示的是三態，其餘進 tooltip**（P4 漸進揭露）——**不是丟掉**。
   */
  reportSyncPhase?(phase: SyncPhase, source: string | null, detail: string): void

  /** 宿主那側下的同步指令（它的狀態列／命令面板）。 */
  onSyncCommand?(callback: (command: HostSyncCommand) => void): void

  /**
   * 把控制項的**完整狀態**（含值域）交給宿主。
   *
   * 🔴 **值域要跟著送**——宿主不認得目標登錄表／風格預設／語系清單，
   * 而讓它認得，就是把那些真相搬到第二個地方。
   *
   * ⚠️ 與 `HostProfile.controlSurfaces` 是同一件事的兩端：投影到 `host*`
   * 的每一種，這裡就要交得出去。由第六十三條護欄對釘。
   */
  reportControls?(states: readonly ControlState[]): void

  /** 宿主那側按了控制項。 */
  onControlInvoke?(callback: (invoke: ControlInvoke) => void): void

  /**
   * 程式的輸出交給宿主的終端機。
   *
   * 🔴 **與 `controlSurfaces.output` 是同一件事的兩端**——宣告
   * `hostTerminal` 的宿主必須實作這一組，否則程式在講話而沒有人聽得到。
   */
  reportConsole?(chunk: string): void

  /** 宿主要求清空終端機那一側。 */
  clearConsole?(): void

  /** 使用者在宿主的終端機打了一行。 */
  onConsoleInput?(callback: (line: string) => void): void

  /**
   * 程式在等輸入了。
   *
   * ⚠️ **只有「唯讀的主控台」的宿主需要它**：終端機自己收得到打字，
   * 而一個當成主控台用的編輯器分頁是唯讀的——那時要由宿主去問。
   */
  reportConsoleAwaitingInput?(prompt: string): void

  /**
   * 變數快照交給宿主的 `panel` 區。
   *
   * 🔴 **與 `controlSurfaces.inspector` 是同一件事的兩端**。
   * ⚠️ 它的終局是 DAP 的 Variables 視圖——而在那之前，
   * 「跟終端機同一排」已經是一個真的位置，不是暫時的將就。
   */
  reportVariables?(groups: readonly { name: string; collapsed: boolean; variables: readonly { name: string; type: string; value: string }[] }[]): void

  /**
   * 🔴 **這個宿主打不開終端機**——面板要自己把主控台畫回來。
   *
   * ⚠️ 它是**能力探測的結果**，不是設定。`controlSurfaces.output` 說的是
   * 「這個宿主**應該**有終端機」，而這一格說的是「**實際上**沒有」
   * ——兩者不同，而把它們混成一件事會讓 Arduino IDE 的執行沒有出口。
   *
   * > **一個宣告過的能力仍然可能在某個宿主上做不到；
   * > 而處置是【問得出來】，不是【猜它是誰】。**
   */
  onConsoleFallback?(callback: () => void): void

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
