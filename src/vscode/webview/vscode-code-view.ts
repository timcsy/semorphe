/**
 * 程式碼視圖 —— **在這個宿主裡它把文字交給 IDE 的編輯器**。
 *
 * ## 它沒有畫布
 *
 * 網頁版的實作**是**一個編輯器；這一個**不是**——它是一個**代理**：
 *
 * ```
 * getCode()      讀本地鏡像（🔴 因為呼叫端是同步的，而真相在另一個行程）
 * setCode()      算出範圍 → 交給宿主寫回
 * addHighlight() 轉成宿主的裝飾
 * onCursorChange 宿主的游標事件轉進來
 * ```
 *
 * ⚠️ 所以建構子拿到的容器**不會被畫任何東西**——它存在只是為了符合角色的形狀。
 *
 * ## 🔴 鏡像會過期，而處置是比對版本不是等待
 *
 * ```
 * 送出編輯 → 樂觀更新鏡像 → 宿主套用 → 回報新版本
 * ```
 *
 * 中間那一瞬間鏡像是「預期的內容」而不是「已確認的內容」。
 * 每次送出都帶**這次是根據哪個版本算的**；宿主發現文件已經不是那個版本
 * → **丟掉這次編輯並重送全文**。
 *
 * 🔴 **那不是防迴圈**（防迴圈用回音的身分，住在宿主那一側），
 * **它防的是踩掉別人的修改**。
 *
 * > **兩個問題長得像，而它們的性質不同。**
 *
 * ## ⚠️ 一個【已知的重複】，寫在這裡讓它看得見
 *
 * 網頁版的 `core/sync-controller.ts` 也在做雙向同步，用布林旗標防迴圈。
 * 而這裡是**跨行程、非同步、有外來變更**——性質不同。
 *
 * 2026-08-18 拍板**兩份並存**，理由是硬合成一份會做出一個兩邊都不好用的抽象
 * （`components/概念代數.md`「假的父概念沒有剪枝力」）。
 * 🔴 **而它是一個已知的重複，不是一個沒有人知道的重複。**
 */
import { rewriteSpan } from '../../core/projection/rewrite-span'
import { diagNote } from '../../core/diag-log'
import { preserveBlankLines } from '../../core/projection/preserve-blank-lines'
import { postToHost } from './host-bridge'
import { textFingerprint } from '../sync/fingerprint'
import type { CodeView, HighlightVariant } from '../../core/host/code-view'
import type { ControlState, ControlInvoke } from '../../core/host/controls'
import type { CodeMapping } from '../../core/projection/code-generator'
import type { SemanticNode } from '../../core/types'
import type { DiagnosticsEvent } from '../../core/view-host'
import { projectDiagnostics } from '../../core/projection/diagnostic-projection' 
import type { SemanticBus } from '../../core/semantic-bus'
import type { SemanticUpdateEvent, ExecutionAtNodeEvent, ViewHost, ViewCapabilities } from '../../core/view-host'
import type { HostMessage, WebviewMessage } from '../sync/messages'

export class VscodeCodeView implements CodeView, ViewHost {
  /** 🔴 宿主的文件是權威，而它晚到——開機時不得由我們先寫一份骨架。見埠上的說明。 */
  readonly documentBacked = true

  /**
   * 🔴 **它必須是一個 `ViewHost`，否則收不到 `semantic:update`。**
   *
   * `ui/app.ts` 用 `registerViewsIn(elements)` **掃描**出視圖，而判準是
   * 「有沒有 `viewId` ＋ 契約上的那幾個方法」。
   *
   * ⚠️ 2026-08-18 少了這三行的症狀是：**面板出得來、積木畫得出來，
   * 而改積木完全不會寫回檔案** ——因為這個視圖根本不在登錄表裡。
   *
   * 🟢 而 `view-registry.ts` 對「有 `viewId` 卻缺方法」會拋錯，
   * ⚠️ 但對「**完全沒有 `viewId`**」是靜靜地略過
   * ——那正是我踩到的那一邊。
   *
   * > **一個「認得出殘缺、認不出缺席」的掃描，
   * > 會把「忘了加入」顯示成「一切正常」。**
   */
  readonly viewId = 'vscode-code-view'
  readonly viewType = 'code'
  readonly capabilities: ViewCapabilities = {
    editable: true,
    needsLanguageProjection: true,
    consumedAnnotations: [],
  }

  /**
   * 🔴 **四個可選能力全部沒有，而每一個都有理由。**
   *
   * ⚠️ 它們**不是空實作**——專案明令「顯式的空與遺漏的空要分得出來，
   * 而一個 noop 函式兩者長得一樣」。
   */
  readonly absentReasons = {
    relayout: '編輯器不歸我們管——版面由 IDE 自己排',
    applyMobileOptions: '這個宿主是桌面應用，沒有行動版',
    applyDesktopOptions: '同上——沒有行動版就沒有「切回桌面版」這件事',
    getEditor: '底層編輯器在另一個行程，交不出來',
  } as const

  /** 🔴 文字的本地鏡像——`getCode()` 是同步的，而真相在另一個行程。 */
  private mirror = ''
  private version = -1
  /**
   * 🔴 **有一次編輯還在路上。**
   *
   * `applyEdit` 是樂觀的：送出去之後宿主才套用，而套用會讓 `version` 前進。
   * ⚠️ 在收到 `applied` 之前又送第二筆，它的 `baseVersion` 就是**過期的**
   * ——宿主會把它當成「期間有外來改動」丟掉，並重送文件，
   * 而重送會觸發 code→blocks，把使用者剛動的積木**回捲**。
   *
   * > **跨行程的樂觀更新要嘛等回覆，要嘛就會有一筆被丟掉
   * > ——而被丟掉的那一筆在使用者眼裡是「我的修改不見了」。**
   */
  private inFlight = false
  /** 對帳對不上的次數——🔴 診斷指令要顯示它（見 `webview/main.ts`）。 */
  private divergences = 0
  /**
   * 最近幾次寫入的流水帳。
   *
   * 🔴 **為什麼要留帳**：使用者連續回報「檔案被寫壞了」，而我三次靠推理去修，
   * 兩次修出新的問題。⚠️ 螢幕截圖說得出**結果**，說不出**是哪一次寫入造成的**。
   *
   * > **一個沒有紀錄的系統，只能被推理；
   * > 而推理出來的修法，要靠下一次災難來驗證對不對。**
   */
  private readonly writeLog: string[] = []
  /** 被安全網擋下來的寫入次數。⚠️ 非 0 代表**上游還有一個真的 bug**。 */
  private blocked = 0

  /** 只留最近 20 筆——這是診斷用的，不是稽核用的。 */
  private note(line: string): void {
    this.writeLog.push(line)
    if (this.writeLog.length > 20) this.writeLog.shift()
    // 🔴 **同一則也進共同時間軸**——見 `core/diag-log.ts` 的檔頭：
    //    兩份各自正確的日誌沒有共同順序時，合起來講不出因果。
    diagNote(line)
  }
  /** ⚠️ 在路上時最後一次想要的內容——只留最新的，中間狀態沒有意義。 */
  private queued: string | null = null
  private changeCb: ((code: string) => void) | null = null
  private cursorCb: ((line: number) => void) | null = null
  private readonly onHostMessage: (e: MessageEvent<HostMessage>) => void

  constructor(_container: HTMLElement) {
    // ⚠️ 容器刻意不使用——見檔頭「它沒有畫布」。
    this.onHostMessage = (e) => this.receive(e.data)
    window.addEventListener('message', this.onHostMessage)
  }

  private post(m: WebviewMessage): void {
    // 🔴 走**唯一接觸點**——`acquireVsCodeApi()` 一個 Webview 只能叫一次，
    //    而那個限制在 Chromium 預檢裡看不見（見 `host-bridge.ts` 的檔頭）。
    postToHost(m)
  }

  /** 主行程下的同步指令——由組裝點接（`app.ts`），這裡只轉交 */
  private syncCmdCb: ((cmd: { action: 'pause' | 'resume' | 'use'; viewId?: string }) => void) | null = null

  onSyncCommand(cb: (cmd: { action: 'pause' | 'resume' | 'use'; viewId?: string }) => void): void {
    this.syncCmdCb = cb
  }

  /** 三態變了就報給主行程——狀態列住在那裡 */
  reportSyncPhase(phase: 'live' | 'paused' | 'diverged', source: string | null, detail: string): void {
    // ⚠️ `detail` 是狀態列本來那一行的其餘部分——🔴 面板不畫了，
    //    但那些字不會憑空消失：它們進宿主狀態列的 tooltip。
    postToHost({ type: 'syncPhase', phase, source, detail })
  }

  private codeMappings: CodeMapping[] = []
  private currentTree: SemanticNode | null = null

  /**
   * 診斷 → **宿主的 Problems**（2026-08-25）。
   *
   * ## 為什麼是 Problems 而不是面板裡的一塊
   *
   * > **搬面板只是換了個位置；走管道才拿得到 F8、紅色波浪線，
   * > 以及使用者已經會的每一個快捷鍵。**
   *
   * ⚠️ 而它**不需要新的頻道**：`onDiagnostics` 早就是廣播
   * （`app.ts` 的 `runAllDiagnostics` 對每個登錄的視圖發），
   * 這裡只是第二個接收者。
   *
   * 🔴 **對映不到的那些直接不送**——見 `mappingFor` 的檔頭：
   * 一個指錯地方的波浪比沒有波浪更糟。
   */
  onDiagnostics(event: DiagnosticsEvent): void {
    const items = projectDiagnostics(event.diagnostics, this.codeMappings, this.currentTree)
    // ⚠️ **每次送整份**——宿主那側的語義是取代，所以「診斷變少了」
    //    會自動反映，不需要另外清。
    postToHost({ type: 'problems', items })
  }

  reportConsole(chunk: string): void {
    postToHost({ type: 'console', chunk })
  }

  clearConsole(): void {
    postToHost({ type: 'console', clear: true })
  }

  reportConsoleAwaitingInput(prompt: string): void {
    postToHost({ type: 'console', awaitingInput: prompt })
  }

  reportVariables(groups: readonly { name: string; collapsed: boolean; variables: readonly { name: string; type: string; value: string }[] }[]): void {
    postToHost({ type: 'variables', groups: groups as never })
  }

  onConsoleInput(callback: (line: string) => void): void {
    this.consoleCb = callback
  }

  onConsoleFallback(callback: () => void): void {
    this.consoleFallbackCb = callback
  }

  private consoleFallbackCb: (() => void) | null = null

  private consoleCb: ((line: string) => void) | null = null

  reportControls(states: readonly ControlState[]): void {
    // 🔴 每次送整份——⚠️ 值域也一起，主行程不認得任何一個登錄表。
    postToHost({ type: 'controls', items: states as never })
  }

  onControlInvoke(callback: (invoke: ControlInvoke) => void): void {
    this.controlCb = callback
  }

  private controlCb: ((invoke: ControlInvoke) => void) | null = null

  private receive(m: HostMessage): void {
    if (m.type === 'syncCommand') {
      this.syncCmdCb?.({ action: m.action, viewId: m.viewId })
      return
    }
    if (m.type === 'controlInvoke') {
      this.controlCb?.({ id: m.id as never, value: m.value, values: m.values })
      return
    }
    if (m.type === 'consoleInput') {
      this.consoleCb?.(m.line)
      return
    }
    if (m.type === 'consoleFallback') {
      this.consoleFallbackCb?.()
      return
    }
    if (m.type === 'document') {
      this.mirror = m.text
      this.version = m.version
      // ⚠️ 宿主重送文件＝它是權威——在路上的那一筆已經被它丟掉了。
      this.inFlight = false
      this.queued = null
      // ⚠️ 通知應用「程式碼變了」——而**這是外來的變更**，
      //    我們自己造成的那些已經被宿主的回音守衛擋掉了。
      diagNote(`📄 宿主送來文件｜版本 ${this.version}｜${this.mirror.split('\n').length} 行`)
      this.changeCb?.(this.mirror)
    } else if (m.type === 'applied') {
      // 🔴 宿主套用了，版本前進——**沒有這一則，下一筆必然過期**。
      this.version = m.version
      this.inFlight = false
      // 🔴 **對帳。** 樂觀更新的鏡像只要錯一次，之後每一段範圍都是錯位的
      //    ——而第一次分歧不會出聲（使用者看到的是檔案被寫爛）。
      //    ⚠️ 對不上時**丟掉手上的東西**：宿主是權威，我們手上的已經證明是錯的。
      if (textFingerprint(this.mirror) !== m.fingerprint) {
        this.divergences += 1
        // ⚠️ **自癒要出聲。** 一個安靜自癒的機制會把「還有一個真的 bug」
        //    藏起來——而我們正是靠這個計數才知道它有沒有再發生。
        //
        // > **一個沒有人看得到的復原，與一個沒有發生過的錯誤，
        // > 在紀錄上長得一樣。**
        console.warn(`[semorphe] 鏡像與文件對不上（第 ${this.divergences} 次）——丟掉手上的，向宿主要一份`)
        this.queued = null
        this.post({ type: 'requestDocument', reason: '積木側的鏡像與文件對不上' })
        return
      }
      const q = this.queued
      this.queued = null
      if (q !== null) this.setCode(q)
    } else if (m.type === 'noDocument') {
      this.mirror = ''
      this.version = -1
      this.inFlight = false
      this.queued = null
      // ⚠️ **刻意不通知應用。** 通知它「程式碼變成空的」會把使用者的積木清掉
      //    ——而他只是點到了一個 markdown 檔。
      //    🔴 為什麼不同步這件事由宿主層的橫幅說（`no-document-banner.ts`）。
    } else if (m.type === 'selection') {
      this.cursorCb?.(m.line)
    }
  }

  // ─── A：文字內容 ───

  getCode(): string {
    // ⚠️ 在路上時要回**想要的那份**，不是已送出的那份——呼叫端問的是「現在的程式碼」。
    return this.queued ?? this.mirror
  }

  setCode(code: string): void {
    // 🔴 **還沒收到文件就不准寫回去。**
    //
    // `version < 0` 代表我們**從來沒有讀過**這份文件。而應用在 `init()` 期間
    // 會產生一次程式碼（空工作區 → 鷹架），如果那時就寫出去，結果是
    // 在使用者的 sketch 後面接上
    //
    // ```cpp
    // int main() {
    //     return 0;
    // }
    // ```
    //
    // ⚠️ 2026-08-18 在 Arduino IDE 實測到的就是這個。
    //
    // > **寫一份你還沒讀過的檔案，寫的一定不是它的內容
    // > ——而是「如果它是空的，它會長什麼樣」。**
    //
    // 🟢 這與 `host-no-overwrite.test.ts` 守的是同一條性質的另一半：
    //    那一條擋「用舊存檔蓋掉」，這一條擋「用空狀態蓋掉」。
    if (this.version < 0) return
    if (this.inFlight) { this.queued = code; return }
    // 🔴 **把使用者的空行還回去**——見 `core/projection/preserve-blank-lines.ts`。
    //
    // 產生器不知道空行存在（實測：Arduino 樣板 10 行 → 6 行），所以只要
    // 某一段被重寫，**沒被碰過的空行也會一起消失**：2026-08-19 使用者往
    // `setup()` 拖一顆積木，而 `loop()` 裡的空行不見了。
    //
    // 🟢 而它順帶治好一件更大的事：沒有語義變動時，還原後**與原檔逐字相同**
    //    → `rewriteSpan` 回 `null` → **整個寫入不會發生**。
    //    在此之前，每一次同步都在重寫檔案。
    code = preserveBlankLines(this.mirror, code)
    const span = rewriteSpan(this.mirror, code)
    if (span === null) return   // ⚠️ 沒有差異 → **不產生檔案變更**

    // ─────────────────────────────────────────────────────────────
    // 🔴 **安全網：一次同步不得刪掉大半個檔案。**
    //
    // ⚠️ 這**不是修好了根因**，是把後果從「檔案沒了」降成「這一次沒同步」。
    //    使用者實測連續遇到：整份 sketch 變成 `int x;`、`setup()`／`loop()` 消失。
    //    兩者的共同形狀都是**積木那側的內容比檔案少很多，然後寫了回去**。
    //
    // > **兩邊不一致的時候，「以少的為準」會刪掉資料，
    // > 「以多的為準」只會多一次同步——而這兩件事的代價差了一個量級。**
    //
    // 判準用**非空白行**，因為排版差異不該算進來。
    // 🔴 而它必須**出聲**：一個安靜擋下來的寫入，與一個沒有發生的 bug 長得一樣。
    // ─────────────────────────────────────────────────────────────
    const solid = (t: string): number => t.split('\n').filter((l) => l.trim() !== '').length
    const before = solid(this.mirror)
    const after = solid(code)
    if (before >= 4 && after * 2 < before) {
      this.blocked += 1
      this.note(`⛔ 擋下：${before} → ${after} 行（少了 ${before - after}）`)
      console.warn(
        `[semorphe] 擋下一次會刪掉大半檔案的同步：非空白行 ${before} → ${after}。` +
        `檔案沒有被改。若這是你要的，請用工具列的「積木→程式碼」再按一次。`,
      )
      // ⚠️ 讓兩邊回到一致——我們手上的東西已經證明可疑。
      this.post({ type: 'requestDocument', reason: '擋下一次大量刪除，重新取一份文件' })
      return
    }
    this.note(`✏️ ${span.startLine}–${span.endLine} → ${span.lines.length} 行｜${before} → ${after} 行`)
    this.mirror = code          // 樂觀更新；宿主套用後回報新版本（`applied`）
    this.inFlight = true
    this.post({ type: 'applyEdit', span, baseVersion: this.version })
  }

  setCodePreserveCursor(code: string, _linesDelta: number): void {
    // 🟢 範圍編輯**天然保住游標**——只重寫改到的那一段，其餘位置不動。
    //    ⚠️ 所以 `linesDelta` 在這裡用不到；網頁版需要它是因為它整份換掉。
    this.setCode(code)
  }

  onChange(callback: (code: string) => void): void {
    this.changeCb = callback
  }

  // ─── B：高亮與游標 ───

  addHighlight(startLine: number, endLine: number, _variant: HighlightVariant): void {
    // ⚠️ 呼叫端是 1-based，而宿主那側是 0-based。
    this.post({ type: 'revealNode', nodeId: null, range: { startLine: startLine - 1, endLine: endLine - 1 } })
  }

  clearHighlight(): void {
    this.post({ type: 'revealNode', nodeId: null, range: null })
  }

  dismissPendingHighlight(): void {
    // ⚠️ 網頁版用它取消「還沒送出的那一次高亮」（它有防抖）。
    //    這裡沒有防抖——高亮是一則訊息，送了就送了。
    //    🔴 而它是**必要能力**所以不能缺席；這裡的正確行為就是「什麼都不用做」。
  }

  /** 對帳對不上過幾次。⚠️ 0 以外的任何數字都代表**還有一個真的 bug**。 */
  get divergenceCount(): number {
    return this.divergences
  }

  /** 被安全網擋下來幾次。⚠️ 同上——非 0 代表上游還有問題。 */
  get blockedCount(): number {
    return this.blocked
  }

  /** 最近幾次寫入的流水帳，給診斷指令用。 */
  get writeHistory(): readonly string[] {
    return this.writeLog
  }

  onCursorChange(callback: (line: number) => void): void {
    this.cursorCb = callback
  }

  // ─── D：生命週期 ───

  connectBus(_bus: SemanticBus): void {
    // ⚠️ **顯式的空，不是忘了寫。**
    //
    // 網頁版的編輯器面板訂閱匯流排是為了自己更新；而這裡的更新走
    // `onSemanticUpdate`（應用直接推給它）與宿主的文件事件——**兩條都不經過匯流排**。
    // 🔴 而它是【必要能力】所以不能缺席：一個宿主沒有的東西才放 `absentReasons`，
    //    而這一個是「有這件事，只是它在這裡不需要做什麼」。
  }

  onSemanticUpdate(event: SemanticUpdateEvent): void {
    // 🔴 **對映與樹要留著**——診斷是用 `nodeId` 錨的，而 IDE 的 Problems
    //    要的是行號。⚠️ 這一格與 `MonacoPanel` 做同一件事，
    //    而**投影的實作在核心**（`core/projection/diagnostic-projection.ts`）。
    if (event.mappings) this.codeMappings = event.mappings
    if (event.tree) this.currentTree = event.tree
    // 應用透過匯流排說「樹變了，程式碼是這個」——而寫回走 `setCode`。
    // ⚠️ `source === 'code'` 代表這一輪【是程式碼那側發動的】，寫回去就是迴圈。
    if (event.source === 'code') return
    const code = (event as { code?: unknown }).code
    if (typeof code === 'string') this.setCode(code)
  }

  async initialize(): Promise<void> {
    // ⚠️ **顯式的空**：這個視圖沒有要初始化的東西——它的「內容」在另一個行程，
    //    而訊息的訂閱在建構子裡就掛好了。
  }

  /** 這個視圖不消費執行狀態（高亮走 `onExecutionAtNode`）。 */
  onExecutionState(): void {
    // ⚠️ **顯式的空**：執行的狀態變化（開始／暫停／結束）在程式碼那一側
    //    沒有投影——它的投影是「執行到哪一行」，而那走 `onExecutionAtNode`。
  }

  onExecutionAtNode(event: ExecutionAtNodeEvent): void {
    // 🔴 執行到哪個節點是**唯一真實**；這裡只是它在程式碼那一側的投影。
    //    ⚠️ 而範圍由應用那側查出來——這裡只轉送 nodeId。
    this.post({ type: 'executionAt', range: null, nodeId: event.nodeId })
  }

  dispose(): void {
    window.removeEventListener('message', this.onHostMessage)
    this.changeCb = null
    this.cursorCb = null
  }
}
