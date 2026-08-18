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
import type { CodeView, HighlightVariant } from '../../core/host/code-view'
import type { SemanticBus } from '../../core/semantic-bus'
import type { SemanticUpdateEvent, ExecutionAtNodeEvent } from '../../core/view-host'
import type { HostMessage, WebviewMessage } from '../sync/messages'

declare function acquireVsCodeApi(): { postMessage(m: unknown): void }

export class VscodeCodeView implements CodeView {
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

  private readonly host = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null
  /** 🔴 文字的本地鏡像——`getCode()` 是同步的，而真相在另一個行程。 */
  private mirror = ''
  private version = -1
  private changeCb: ((code: string) => void) | null = null
  private cursorCb: ((line: number) => void) | null = null
  private readonly onHostMessage: (e: MessageEvent<HostMessage>) => void

  constructor(_container: HTMLElement) {
    // ⚠️ 容器刻意不使用——見檔頭「它沒有畫布」。
    this.onHostMessage = (e) => this.receive(e.data)
    window.addEventListener('message', this.onHostMessage)
  }

  private post(m: WebviewMessage): void {
    this.host?.postMessage(m)
  }

  private receive(m: HostMessage): void {
    if (m.type === 'document') {
      this.mirror = m.text
      this.version = m.version
      // ⚠️ 通知應用「程式碼變了」——而**這是外來的變更**，
      //    我們自己造成的那些已經被宿主的回音守衛擋掉了。
      this.changeCb?.(this.mirror)
    } else if (m.type === 'noDocument') {
      this.mirror = ''
      this.version = -1
      this.changeCb?.('')
    } else if (m.type === 'selection') {
      this.cursorCb?.(m.line)
    }
  }

  // ─── A：文字內容 ───

  getCode(): string {
    return this.mirror
  }

  setCode(code: string): void {
    const span = rewriteSpan(this.mirror, code)
    if (span === null) return   // ⚠️ 沒有差異 → **不產生檔案變更**
    this.mirror = code          // 樂觀更新；宿主套用後會回報新版本
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
    // ⚠️ 應用透過匯流排說「樹變了，程式碼是這個」——而寫回走 `setCode`。
    if (event.source !== 'code' && typeof event.code === 'string') this.setCode(event.code)
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
