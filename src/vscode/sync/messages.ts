/**
 * 宿主 ↔ Webview 的訊息 —— **兩側共用的唯一一份型別**。
 *
 * ## 為什麼要共用一份
 *
 * 訊息協定是**兩個編譯單元之間**的契約（主行程 CJS／Webview ESM）。
 * 各寫一份的話，改了一邊而另一邊沒改**不會有任何東西報錯**
 * ——訊息只是靜靜地不被處理。
 *
 * > **一個跨行程的契約如果有兩份宣告，它就沒有宣告。**
 *
 * ## 🔴 責任的分界，而它是由「膠囊登錄表住哪」決定的
 *
 * ```
 * 主行程     文件的讀寫、設定、per-uri 狀態、生命週期
 *            🔴 它【不認識】語義樹、不 parse、不 generate
 * Webview    parse ＋ lift ＋ generate ＋ 積木 ＋ 執行
 *            🔴 膠囊登錄表住這裡（import.meta.glob 是 Vite 的轉換）
 * ```
 *
 * ⚠️ 於是有一條硬規則：**主行程不得 import 任何會碰到
 * `src/components/` 的東西**——否則 `core/component/registry.ts:22-48`
 * 記的那個坑會回來（esbuild 建得出來，而膠囊一顆都沒打包進去）。
 */
import type { RewriteSpan } from '../../core/projection/rewrite-span'
import type { PanelConfig } from './settings'
import type { ViewState } from './view-state'

// ─── 主行程 → Webview ───

export type HostMessage =
  | {
      /**
       * 主行程下的同步指令——來自狀態列或命令面板。
       *
       * ⚠️ `use` 帶的是**視圖 id**，而那份清單由 webview 那側的
       * `viewsWith('editable')` 導出——**主行程不認識任何一個具體的面板**。
       */
      type: 'syncCommand'
      action: 'pause' | 'resume' | 'use'
      viewId?: string
    }
  | {
      /** 宿主那側按了控制項（狀態列的 QuickPick／標題列的按鈕）。 */
      type: 'controlInvoke'
      id: string
      value?: string
      values?: string[]
    }
  | {
      /**
       * **這個宿主換得動編輯器嗎**（2026-09-02）。
       *
       * 🔴 使用者在 Arduino IDE：「ArduinoIDE 的檔案沒有辦法關閉，所以我建議
       * 在 ArduinoIDE 這邊程式碼不是一個可切換的選項」。
       *
       * 而他說的正是根因：與程式碼那一格對調要**先多開一份撐住位子、再把多的
       * 關掉**（見 `swapWithEditor`）——關不掉的宿主上，那一步會留下一個
       * 使用者關不掉的重複分頁。
       *
       * > **一個做得到一半的功能，在做不到那一半的宿主上不該出現在選單裡
       * > ——一個按了會留下垃圾的選項，比沒有那個選項更糟。**
       */
      type: 'hostCaps'
      canSwapEditor: boolean
      /**
       * **這個宿主答得出「那兩頁現在開著沒有」嗎**（2026-09-02）。
       *
       * 🔴 Arduino IDE 答不出來（實測）：整個 panel 區關掉了，`WebviewView.visible`
       * 仍然回 `true`，`document.hidden` 也還是 `false`（`retainContextWhenHidden`）。
       * 於是選單上兩項都寫著「隱藏…面板」——使用者：「**沒有面板卻還說隱藏**」。
       *
       * > **答不出來的時候，正確的做法不是猜一個，是【不要說】。**
       */
      canObserveBottomVisibility: boolean
    }
  | {
      /** **你現在畫這一層**——槽的下拉在 IDE 裡就是換這個（見 `CodeView.onSetLayer`）。 */
      type: 'setLayer'
      layer: string
    }
  | {
      /** 使用者在終端機打了一行（不含換行）。 */
      type: 'consoleInput'
      line: string
    }
  | {
      /**
       * **執行的輸出轉給主控台那個視圖**（2026-09-02，spec 171）。
       *
       * 🔴 跑程式的是積木那個 webview，而主控台是 panel 區的**另一個** webview
       * ——主行程是它們之間唯一的通道。
       */
      type: 'consoleOut'
      chunk?: string
      clear?: boolean
      awaitingInput?: string
    }
  | {
      /**
       * **panel 區那兩頁現在看得見沒有**（2026-09-02）。
       *
       * 🔴 少了它，版面選單上那兩個標籤只能寫「顯示／隱藏」這種兩件事都說的話
       * ——而使用者要的是「它現在開著就寫隱藏」。
       */
      type: 'bottomVisibility'
      console: boolean
      variables: boolean
    }
  | {
      /** 執行狀態轉給主控台那個視圖——它的狀態列要跟著走。 */
      type: 'execStatusOut'
      status: string
      reason?: string
    }
  | {
      /** 同上，變數快照轉給變數那個視圖。 */
      type: 'variablesOut'
      groups: { name: string; collapsed: boolean; variables: { name: string; type: string; value: string }[] }[]
    }
  | {
      /**
       * 🔴 **這個宿主打不開終端機**——主控台還給面板。
       *
       * ⚠️ 它是**探測的結果**，不是設定：`Pseudoterminal.open()` 沒有被呼叫。
       * 使用者 2026-08-25 在 Arduino IDE 實測到的。
       */
      type: 'consoleFallback'
    }
  | {
      type: 'document'
      uri: string
      languageId: string
      /** 文件的**實際文字**——🔴 範圍計算要拿它比，不是拿 `generate(原樹)` 比 */
      text: string
      /** 宿主的版本號。**單調遞增**（含 undo／redo），所以它是回音的身分 */
      version: number
    }
  /**
   * 沒有可同步的文件。
   *
   * 🔴 **`reason` 不是選用的。** 2026-08-18 使用者連續兩次回報「沒同步」，
   * 而真正的原因是他開的是一個沒有副檔名、語言是「純文字」的暫存分頁
   * ——**擴充當下就知道**，卻什麼都沒說。
   *
   * > **一個知道自己為什麼動的元件如果不說，
   * > 使用者看到的就是「壞了」，而不是「條件沒滿足」。**
   */
  | { type: 'noDocument'; reason: string }
  /**
   * 🔴 **我們送出的編輯套用了，新的版本號是這個。**
   *
   * ## 為什麼非有不可
   *
   * 宿主套用完編輯之後 `doc.version` 會遞增，而回音守衛會**擋掉**那次文件回送
   * （擋得對——那是我們自己造成的）。⚠️ 但這代表 Webview 那側的版本號
   * **永遠停在編輯前**，於是下一次 `applyEdit` 的 `baseVersion` 必然過期，
   * 被宿主當成「期間有外來改動」丟掉並重送文件
   * ——而重送會觸發 code→blocks，把使用者剛動的積木**回捲**。
   *
   * 症狀：**第一筆編輯成功，之後每一筆都無效**（2026-08-18 使用者實測）。
   *
   * > **樂觀更新要能收斂，必須有一條回報新狀態的路；
   * > 只擋回音而不回報，會讓兩邊的版本永遠差一。**
   */
  | {
      type: 'applied'
      version: number
      /**
       * 🔴 **套用之後宿主那份文字的指紋**——見 `fingerprint.ts`。
       *
       * 樂觀更新的鏡像只要錯一次，之後每一段範圍都是錯位的，
       * ⚠️ 而**第一次分歧不會出聲**。有指紋才對得了帳。
       */
      fingerprint: number
    }
  /** 使用者把游標移到某一行——⚠️ **這個事件很吵**（每次移動都發）。 */
  | { type: 'selection'; line: number }
  /** 宿主要求回報診斷——⚠️ 由指令觸發，**不佔面板的版面**（FR-009）。 */
  | { type: 'requestDiagnostics' }
  | { type: 'config'; config: PanelConfig }
  | { type: 'viewState'; state: ViewState }

// ─── Webview → 主行程 ───

/**
 * 同步的三態——**由 webview 報給主行程**，主行程把它畫在狀態列上。
 *
 * 🔴 為什麼狀態列住在主行程：它是**宿主都有的 chrome**（VSCode／Theia／網頁版），
 * 而我們自己畫的工具列不是。使用者 2026-08-25：「全域，**不放在面板裡**」。
 *
 * ⚠️ 而三態在這一側同樣需要——我一度以為不必（「這裡真相是文件」），
 * 那只推得掉「誰是來源」那一格：**暫停**（收到 `document` 就重 lift，排版沒了）
 * 與**分岔**（文件還會被 git／別人改）在這一側**更常見**。
 */
export type SyncPhaseWire = 'live' | 'paused' | 'diverged'

/** ⚠️ 線上的形狀刻意與 `core/projection/diagnostic-projection.ts` 的 `CodeDiagnostic` 一致。 */
export interface CodeDiagnosticWire {
  startLine: number
  startColumn: number
  endLine: number
  /** `null` ＝ 到行尾。⚠️ **只有主行程知道行尾在哪**（它有文件）。 */
  endColumn: number | null
  severity: 'warning' | 'error'
  message: string
}

/** ⚠️ 線上的形狀刻意與 `core/host/controls.ts` 的 `ControlState` 一致。 */
export interface ControlStateWire {
  id: string
  kind: 'picker' | 'action' | 'indicator'
  /** 這顆控制項**叫什麼**（選單的標題）。⚠️ 與 `label`（目前的值）是兩件事。 */
  title: string
  label: string
  value?: string
  /**
   * ⚠️ **`group` 與 `description` 要跟著過來**（2026-09-01）。
   *
   * 🔴 核心的 `ControlOption` 一直都有這兩格，而這一行只宣告了 `{value,label}`
   * ——於是骨架選單在 IDE 裡是**一條沒有分組的平清單**：
   *
   * ```
   * 網頁版                          VSCode（修之前）
   *   骨架                            C++ 標準骨架
   *     C++ 標準骨架  #include + …    沒有骨架
   *     沒有骨架      沒有 main…      Arduino 骨架
   *   顯示                            淡的
   *     隱藏  目前                    完整
   * ```
   *
   * 使用者：「**沒有辦法區分骨架和顯示**，像是網頁版就可以」。
   *
   * > **一個窄化的線上型別不會弄壞資料——它讓【已經在線上的東西】看起來不存在。**
   *
   * ⚠️ 資料本來就過得來（`reportControls` 送的是整顆 `ControlState`）；
   * 少的是**宣告**與**消費**。
   */
  options?: { value: string; label: string; group?: string; description?: string }[]
  multi?: boolean
  picked?: string[]
}

export type WebviewMessage =
  | {
      /** 三態變了——主行程據此更新狀態列 */
      type: 'syncPhase'
      phase: SyncPhaseWire
      /** 目前的來源（`null` ＝ 暫停中或分岔中）。**沒有來源不是一種來源** */
      source: string | null
      /**
       * 面板狀態列本來那一行的其餘部分（語言｜風格｜積木風格｜主題｜語系）。
       *
       * 🔴 面板在這個宿主裡**不畫狀態列**（`features.statusBar: false`），
       * 而那些字不該跟著消失——它們進宿主狀態列的 tooltip。
       */
      detail: string
    }
  | {
      /**
       * 控制項的完整狀態（含值域）——主行程據此建狀態列項目與標題列按鈕。
       *
       * 🔴 **每次都送整份**，不送差異：一份會漂移的差異流，
       * 遠比一份小小的整份昂貴。
       */
      type: 'controls'
      items: ControlStateWire[]
    }
  | {
      /**
       * 診斷 → 主行程 → **IDE 的 Problems**。
       *
       * 🔴 **每次送整份**：`DiagnosticCollection.set` 的語義是取代，
       * 所以「診斷變少了」會自動反映，不需要另外送一則「清掉」。
       */
      type: 'problems'
      items: CodeDiagnosticWire[]
    }
  | {
      /** 變數快照 → 主行程 → `panel` 區的視圖。 */
      type: 'variables'
      groups: { name: string; collapsed: boolean; variables: { name: string; type: string; value: string }[] }[]
    }
  | {
      /**
       * **請宿主用它自己的選單問「這一格顯示什麼」**（2026-09-02）。
       *
       * 🔴 使用者：「**為何選單不是像網頁那樣是全域的**？」——而在 IDE 裡
       * 它做不到：一個 webview 只畫得到**自己那個矩形**，`position: fixed`
       * 的盡頭是這塊面板的邊界，不是視窗的邊界。
       *
       * 🟢 但**宿主的選單是全域的**——而這正是這個專案既有的做法：
       * 控制項（目標／課程／風格…）早就投影到宿主的 QuickPick 了
       * （`controlSurfaces`）。這一則讓槽的下拉走同一條路。
       *
       * > **一個畫不出去的邊界，不是用更大的 z-index 解決的
       * > ——是把那件事交給畫得出去的那個人。**
       */
      type: 'pickLayer'
      title: string
      items: { value: string; label: string; description?: string }[]
    }
  | {
      /**
       * **把我這一格換成另一層**（2026-09-02）。
       *
       * 🔴 在 IDE 裡「這一格顯示什麼」不是我們排得動的——每一種投影是一個
       * 獨立的分頁，而**分頁擺在哪一欄是宿主的事**。所以槽的下拉在這裡
       * 不做本地置換，而是**請宿主把那一層叫到我這一欄來**。
       *
       * > **一個排不動版面的宿主上，「這一格顯示什麼」要問的不是版面，
       * > 是「請你把它放到我這裡」。**
       */
      type: 'showLayer'
      layer: string
    }
  | {
      /**
       * **我這個 webview 現在看得見嗎**（2026-09-02）。
       *
       * 🔴 宿主那側的 `WebviewView.visible` 在 Arduino IDE 上**說了謊**：
       * 變數那一頁明明不是被選到的分頁，它仍然回 `true`，於是版面選單上
       * 寫著「隱藏變數面板」——而它根本沒開。
       *
       * > **一個「你看得見嗎」的問題，最可靠的回答者是【被看的那一個】。**
       */
      type: 'viewVisible'
      visible: boolean
    }
  | {
      /** **開關宿主 panel 區的某一頁**（版面選單裡那兩項）。 */
      type: 'toggleConsole'
      page: 'console' | 'variables'
    }
  | {
      /** 執行狀態 → 主行程 → 畫主控台的那個視圖。 */
      type: 'execStatus'
      status: string
      reason?: string
    }
  | {
      /**
       * 使用者在**主控台那個視圖**打了一行 → 主行程 → 正在跑的那個視圖。
       *
       * ⚠️ 與 `HostMessage.consoleInput` 是反方向的同一件事。
       */
      type: 'consoleSubmit'
      line: string
    }
  | {
      /** 程式的輸出 → 宿主的終端機。`clear: true` ＝ 清空。 */
      type: 'console'
      chunk?: string
      clear?: boolean
      /** 程式在等輸入。⚠️ 只有「唯讀的主控台」需要據此去問使用者。 */
      awaitingInput?: string
    }
  | {
      type: 'applyEdit'
      span: RewriteSpan
      /**
       * 這次編輯是根據哪一個版本算出來的。
       *
       * ⚠️ 主行程要比對：文件已經變成別的版本了 → **這次編輯過期了**。
       * 🔴 那不是「防迴圈」（那是回音守衛的事），是**防止踩掉外來的改動**。
       */
      baseVersion: number
    }
  | { type: 'ready'; capsules: number; specs: number }
  /**
   * 「把目前這個分頁設成 C++」——由「沒有文件可同步」的橫幅上那顆按鈕發出。
   *
   * 🔴 **為什麼是一顆按鈕，不是自動判斷。** 使用者要的是「支援選了 C++ 的
   * Untitled-1」，而新開的暫存分頁預設是純文字。自動改掉使用者編輯器的語言
   * 是一個**沒有被要求的副作用**；一顆寫著它會做什麼的按鈕不是。
   *
   * > **替使用者做決定與讓使用者一鍵做決定，差別在他知不知道發生了什麼。**
   */
  | { type: 'setLanguageCpp' }
  /**
   * 🔴 **我的鏡像跟你對不上，請重送一份。**
   *
   * ⚠️ 這不是「防禦性程式設計」——它是**分歧發生時唯一正確的動作**：
   * 宿主是權威，而積木那側手上的東西已經證明是錯的。
   *
   * > **偵測得到而不能回復的檢查，只會把安靜的壞換成吵鬧的壞。**
   */
  | { type: 'requestDocument'; reason: string }
  /** 診斷報告。🔴 它去宿主的輸出頻道，不去面板。 */
  | { type: 'diagnostics'; lines: string[] }
  /**
   * 使用者點了一顆積木 → 請宿主照亮這幾行。
   *
   * ⚠️ `range` 是 `null` 代表**那顆積木指不到程式碼**（實測 1.5% 的節點沒有範圍）
   * ——🔴 而那要**說得出來**，不是靜默什麼都不做（FR-007）。
   */
  | { type: 'revealNode'; nodeId: string | null; range: { startLine: number; endLine: number } | null }
  | { type: 'viewStateChanged'; state: ViewState }
  /** 面板上的選單被改了。⚠️ 主行程寫進 **workspace** 層級（使用者拍板）。 */
  | { type: 'configChanged'; key: string; value: string }
  /**
   * 執行走到某個節點——🔴 **唯一真實**。
   *
   * ⚠️ 主行程收到它只做一件事：把程式碼那一側照亮。
   * **原生編輯器只是第三個視圖**（`core/view-host.ts:94`），
   * 不要為它另外發明訊息。
   */
  | {
      type: 'executionAt'
      /** 走到哪個節點——🔴 **唯一真實**。`null` ＝ 執行結束，清掉高亮。 */
      nodeId: string | null
      /** 它在程式碼裡的行範圍（0-based）。⚠️ 查不到時是 `null`（實測 1.5% 的節點沒有範圍）。 */
      range: { startLine: number; endLine: number } | null
    }
