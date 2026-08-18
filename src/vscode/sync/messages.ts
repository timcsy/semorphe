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

export type WebviewMessage =
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
