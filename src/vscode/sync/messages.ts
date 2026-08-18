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
