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
 * 網頁版的 `ui/sync-controller.ts` 也在做雙向同步，用布林旗標防迴圈。
 * 而這裡是**跨行程、非同步、有外來變更**——性質不同。
 *
 * 2026-08-18 拍板**兩份並存**，理由是硬合成一份會做出一個兩邊都不好用的抽象
 * （`concepts/概念代數.md`「假的父概念沒有剪枝力」）。
 * 🔴 **而它是一個已知的重複，不是一個沒有人知道的重複。**
 */
import { rewriteSpan } from '../../core/projection/rewrite-span'
import { postToHost } from './host-bridge'
import type { CodeView, HighlightVariant } from '../../core/host/code-view'
import type { SemanticBus } from '../../core/semantic-bus'
import type { SemanticUpdateEvent, ExecutionAtNodeEvent, ViewHost, ViewCapabilities } from '../../core/view-host'
import type { HostMessage, WebviewMessage } from '../sync/messages'

export class VscodeCodeView implements CodeView, ViewHost {
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

  private receive(m: HostMessage): void {
    if (m.type === 'document') {
      this.mirror = m.text
      this.version = m.version
      // ⚠️ 宿主重送文件＝它是權威——在路上的那一筆已經被它丟掉了。
      this.inFlight = false
      this.queued = null
      // ⚠️ 通知應用「程式碼變了」——而**這是外來的變更**，
      //    我們自己造成的那些已經被宿主的回音守衛擋掉了。
      this.changeCb?.(this.mirror)
    } else if (m.type === 'applied') {
      // 🔴 宿主套用了，版本前進——**沒有這一則，下一筆必然過期**。
      this.version = m.version
      this.inFlight = false
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
    if (this.inFlight) { this.queued = code; return }
    const span = rewriteSpan(this.mirror, code)
    if (span === null) return   // ⚠️ 沒有差異 → **不產生檔案變更**
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
