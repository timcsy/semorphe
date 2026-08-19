/**
 * 積木面板——**編輯器區域的一個分頁，而它跟著 active editor 走**。
 *
 * ## 面板跟哪一份文件：跟著 active editor
 *
 * 三個選項裡（跟著走／pin／一份文件一個面板）選了第一個，而**理由是量出來的**：
 *
 * ```
 * parse + lift   中位 4.9 ms
 * 畫 76 顆積木    7.9 ms
 * 一次切分頁      ≈ 13 ms
 * ```
 *
 * 🔴 **而真正的收穫是它把那 18 個 per-document 欄位拆成兩堆**：
 *
 * ```
 * 從文件重算得出來的   → 切分頁時丟掉重建（13 ms）  ⟹ 它們不是狀態，是快取
 * 導不出來的視圖狀態   → 只有這一堆要 per-uri 保存   ⟹ 而它小得多
 * ```
 *
 * > **一個「per-document 的欄位」，如果從文件本身重算得出來，
 * > 那它就不是狀態，是快取。**
 *
 * ## 這個檔【不認識】語義樹
 *
 * 它只搬文字與版本號。parse／lift／generate 全部在 Webview
 * ——理由見 `sync/messages.ts` 的檔頭（膠囊登錄表只在 Vite 打包的那一側活得了）。
 */
import * as vscode from 'vscode'
import { csp, renderHtml } from './webview-html'
import { EchoGuard } from './sync/echo-guard'
import { resolveConfig, type RawSettings } from './sync/settings'
import { textFingerprint } from './sync/fingerprint'
import { applySpan } from '../core/projection/rewrite-span'
import { ViewStateStore, type KeyValueStore, type ViewState } from './sync/view-state'
import type { HostMessage, WebviewMessage } from './sync/messages'

/**
 * 積木 → 程式碼的高亮。
 *
 * ⚠️ 用**主題色**而不是寫死的顏色——寫死的話在淺色主題上會看不見，
 * 而那是「不會報錯的壞」那一族。
 */
const HIGHLIGHT = vscode.window.createTextEditorDecorationType({
  backgroundColor: new vscode.ThemeColor('editor.selectionHighlightBackground'),
  isWholeLine: true,
})

/**
 * **執行到哪一行** —— ⚠️ 與選取高亮**分開**。
 *
 * 🔴 共用一個 decoration 的話，清掉其中一個會把另一個也清掉
 * ——而症狀是「單步時選取的高亮忽然不見了」，看起來像閃爍。
 */
const EXECUTING = vscode.window.createTextEditorDecorationType({
  backgroundColor: new vscode.ThemeColor('editor.findMatchHighlightBackground'),
  isWholeLine: true,
})

/**
 * 診斷的輸出頻道。
 *
 * ⚠️ spec 139 把這些數字畫在面板上，而那佔掉了本來該是工具列的位置。
 * 🔴 **量測沒有被丟掉，是搬家**——由 `semorphe.showDiagnostics` 指令取用。
 */
const OUTPUT = vscode.window.createOutputChannel('Semorphe')

const VIEW_TYPE = 'semorphe.blocks'
const TITLE = 'Semorphe 積木'
const DIST = ['dist']
const MEDIA = ['dist', 'media']

/** 面板能服務哪些文件——與 `manifest.ts` 的入口條件同一組判準。 */
const SUPPORTED_LANGS = new Set(['cpp', 'c', 'arduino'])
const SUPPORTED_EXTS = new Set(['.ino', '.cpp', '.cc', '.cxx', '.c', '.h', '.hpp'])

function isSupported(doc: vscode.TextDocument): boolean {
  if (SUPPORTED_LANGS.has(doc.languageId)) return true
  const path = doc.uri.path
  const dot = path.lastIndexOf('.')
  return dot >= 0 && SUPPORTED_EXTS.has(path.slice(dot))
}

/**
 * **為什麼現在沒有文件可以同步**——一句給人看的話。
 *
 * 🔴 這個函式存在的理由：判斷「支不支援」與「說得出為什麼不支援」是兩件事，
 * 而只做前者的系統在條件沒滿足時，看起來與壞掉一模一樣。
 */
function noDocumentReason(editor: vscode.TextEditor | undefined): string {
  // ⚠️ 焦點在面板上時 `activeTextEditor` 是 `undefined`——**而編輯器就開在旁邊**。
  //    只看 active 會講出「沒有開啟任何編輯器」這種與畫面矛盾的話。
  const target = editor ?? vscode.window.visibleTextEditors[0]
  if (!target) return '沒有開啟任何程式碼編輯器。開一個 .ino 或 .cpp 檔。'
  const doc = target.document
  const untitled = doc.isUntitled
  return (
    `目前的編輯器是「${doc.languageId}」${untitled ? '（未命名的暫存分頁）' : ''}，` +
    `而 Semorphe 只跟 ${[...SUPPORTED_EXTS].join('／')} 同步。` +
    (untitled ? ' → 存成 .ino／.cpp，或用 ⌘K M 選 C++。' : ' → 用 ⌘K M 切換語言。')
  )
}

/**
 * ⚠️ **單例。** 一個工作區只有一個積木面板。
 *
 * 🔴 那是**本輪刻意的簡化**：面板跟著 active editor 走，所以一次只需要一個。
 * 多面板要先把 per-document 的狀態分乾淨，而本輪把它們改成**重建**而不是保存。
 */
let current: SemorpheSession | undefined

class SemorpheSession {
  private readonly panel: vscode.WebviewPanel
  private readonly extensionUri: vscode.Uri
  private readonly disposables: vscode.Disposable[] = []
  private readonly echo = new EchoGuard()
  /** 目前服務的文件。⚠️ 沒有支援的編輯器時是 `undefined`。 */
  private doc: vscode.TextDocument | undefined
  /** 🔴 選取的防迴圈：值相等就不再傳播（選取是冪等的）。 */
  private lastSentLine = -1
  private readonly viewStates: ViewStateStore
  /** ⚠️ 上一份文件的 uri——存檔那一刻要靠它做身分搬遷。 */
  private lastUri: string | undefined

  constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, memento: vscode.Memento) {
    this.panel = panel
    this.extensionUri = extensionUri
    this.viewStates = new ViewStateStore(mementoStore(memento))
    this.panel.webview.html = this.html()

    this.panel.webview.onDidReceiveMessage(
      (m: WebviewMessage) => void this.onWebviewMessage(m), null, this.disposables)

    // 跟著 active editor 走
    vscode.window.onDidChangeActiveTextEditor(() => this.follow(), null, this.disposables)
    vscode.workspace.onDidChangeTextDocument((e) => this.onDocumentChanged(e), null, this.disposables)
    // ⚠️ 這個事件**很吵**（每次移動游標都發）——而反查是一趟 76～131 個節點的
    //    樹走訪（量過，微秒級），所以吵不是問題。
    //    🔴 真正的問題是**迴圈**：照亮程式碼會移動游標 → 又反查 → 又選積木。
    //    處置是**值相等就不傳**。
    vscode.window.onDidChangeTextEditorSelection((e) => this.onSelection(e), null, this.disposables)
    // 🔴 老師改了 settings.json，學生的面板要【自己更新】，不是重開才生效。
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('semorphe')) this.sendConfig()
    }, null, this.disposables)
    // ⚠️ **存檔那一刻身分會變**（`untitled:` → `file://`），而視圖狀態要跟著搬。
    //    🔴 `onDidRenameFiles` 管不到它（那是檔案改名，不是暫存分頁落地）。
    vscode.workspace.onDidSaveTextDocument((doc) => this.onSaved(doc), null, this.disposables)
    // 🔴 **解除綁定只發生在這裡**——見 `follow()` 的檔頭：焦點離開不算。
    vscode.workspace.onDidCloseTextDocument((doc) => {
      if (doc.uri.toString() === this.doc?.uri.toString()) this.unfollow()
    }, null, this.disposables)
    // 使用者用橫幅上的按鈕（或 ⌘K M）改了語言 → 這份文件可能【剛好變成】支援的。
    vscode.workspace.onDidOpenTextDocument(() => this.follow(), null, this.disposables)

    this.follow()
  }

  private send(m: HostMessage): void {
    void this.panel.webview.postMessage(m)
  }

  /**
   * 切到目前的編輯器所編輯的文件。
   *
   * ## 🔴 「沒有作用中的編輯器」**不等於**「沒有文件可同步」
   *
   * 焦點在 Webview 面板上時 `vscode.window.activeTextEditor` 是 `undefined`，
   * 而 `onDidChangeActiveTextEditor` **會帶著 undefined 觸發**。
   * ⚠️ 第一版把那當成「沒有文件」→ **使用者一點進積木面板，同步就斷了**
   * （2026-08-18 實測：面板上跳出「沒有開啟任何程式碼編輯器」而檔案就開在旁邊）。
   *
   * > **一個「焦點離開了」的事件，被讀成「那個東西不存在了」
   * > ——而使用者為了操作面板，一定會讓焦點離開編輯器。**
   *
   * 所以規則是**只往上跟**：看到一份支援的文件就換過去；
   * 看不到就**保持現狀**，不解除綁定。解除只發生在文件關掉時。
   */
  private follow(): void {
    // 🔴 **焦點在面板上時 `activeTextEditor` 是 `undefined`**——而使用者的
    //    sketch 就開在旁邊。退而求其次去找**看得見的**那一份。
    //    ⚠️ 這正是「開面板 → 前兩次操作怪怪的 → 點回編輯器才正常」的成因。
    const editor = vscode.window.activeTextEditor
      ?? vscode.window.visibleTextEditors.find((ed) => isSupported(ed.document))
    if (editor && isSupported(editor.document)) {
      const doc = editor.document
      if (doc.uri.toString() === this.doc?.uri.toString()) return
      this.doc = doc
      // ⚠️ 換文件就清空回音——上一份文件的版本號與這一份無關。
      this.echo.reset()
      this.lastUri = doc.uri.toString()
      this.sendConfig()
      this.sendDocument(doc)
      const vs = this.viewStates.get(doc.uri.toString())
      if (vs) this.send({ type: 'viewState', state: vs })
      return
    }
    // 🔴 已經綁著一份文件 → **什麼都不做**（焦點只是跑到面板或別的檔上）。
    if (this.doc) return
    this.send({ type: 'noDocument', reason: noDocumentReason(editor) })
  }

  /**
   * 把目前看得到的那個分頁設成 C++。
   *
   * 🔴 使用者要的是「支援選了 C++ 的 Untitled-1」，而新開的暫存分頁預設是純文字。
   * ⚠️ 這裡**不自動判斷**——它由橫幅上一顆寫著自己會做什麼的按鈕觸發。
   */
  private async setLanguageCpp(): Promise<void> {
    const editor = vscode.window.activeTextEditor ?? vscode.window.visibleTextEditors[0]
    if (!editor) {
      void vscode.window.showWarningMessage('沒有可以設定語言的編輯器——先開一個分頁。')
      return
    }
    await vscode.languages.setTextDocumentLanguage(editor.document, 'cpp')
    // ⚠️ `setTextDocumentLanguage` 會換掉 document 物件的身分，所以要重新跟。
    this.doc = undefined
    this.follow()
  }

  /** 重送目前的狀態——**不重新決定綁哪一份**（見 `ready` 的處理）。 */
  private resend(): void {
    if (!this.doc) { this.follow(); return }
    this.sendConfig()
    this.sendDocument(this.doc)
    const vs = this.viewStates.get(this.doc.uri.toString())
    if (vs) this.send({ type: 'viewState', state: vs })
  }

  /** 解除綁定——**只有文件關掉時**。 */
  private unfollow(): void {
    this.doc = undefined
    this.echo.reset()
    this.send({ type: 'noDocument', reason: noDocumentReason(vscode.window.activeTextEditor) })
  }

  /**
   * 讀設定並解析。
   *
   * 🔴 以 `{ uri, languageId }` 為範圍 ⟹ 語言覆寫（`"[arduino]": {...}`）解得出來。
   * ⚠️ 而它要求宣告時寫了 `scope: "language-overridable"`——見 `manifest.ts`。
   */
  private sendConfig(): void {
    const doc = this.doc
    const scope = doc ? { uri: doc.uri, languageId: doc.languageId } : undefined
    const c = vscode.workspace.getConfiguration('semorphe', scope)
    const layered = <T>(key: string): { language?: T; workspace?: T; user?: T } => {
      const i = c.inspect<T>(key)
      return {
        language: i?.workspaceLanguageValue ?? i?.globalLanguageValue ?? undefined,
        workspace: i?.workspaceValue ?? undefined,
        user: i?.globalValue ?? undefined,
      }
    }
    const raw: RawSettings = {
      target: layered<string>('target'),
      topic: layered<string>('topic'),
      style: layered<string>('style'),
      blockStyle: layered<string>('blockStyle'),
      locale: layered<string>('locale'),
    }
    // 🔴 傳檔名進去——`.ino` 的預設目標是 Arduino，不是 C++（見 `settings.ts`）。
    this.send({ type: 'config', config: resolveConfig(raw, doc?.uri.path) })
  }

  /**
   * 暫存分頁存檔了 → 身分從 `untitled:` 變成 `file://`。
   *
   * 🔴 而**那正是主場景**（「AI 給的 Code 貼上來」的第一站就是暫存分頁）。
   * ⚠️ 搬完舊 key 要清掉——留著是一個不會被發現的洩漏。
   */
  private onSaved(doc: vscode.TextDocument): void {
    const from = this.lastUri
    const to = doc.uri.toString()
    if (!from || from === to || !from.startsWith('untitled:')) return
    this.viewStates.migrate(from, to)
    this.lastUri = to
  }

  /**
   * 🔴 **宿主這側的時間軸。**
   *
   * 2026-08-19 第五輪：面板那側的時間軸顯示「第 3 則到第 10 則之間一份文件
   * 都沒收到」——⚠️ 而那有**三種可能，在面板那側完全同形**：
   *
   * ```
   * ① 使用者根本沒改文件
   * ② 改了，而 onDocumentChanged 判成【回音】吞掉了
   * ③ 改了、送了，而訊息沒送到（webview 在背景？）
   * ```
   *
   * > **一個「什麼都沒收到」的紀錄，答得出「我沒收到」，
   * > 答不出「有沒有人送」——而那兩件事的修法完全不同。**
   *
   * 所以宿主這側要記：文件變了幾次、每一次判成回音還是外來的、送了沒有。
   */
  private readonly hostLog: string[] = []
  private hostLogSeq = 0
  private hostLogAt = 0

  private hostNote(line: string): void {
    const now = Date.now()
    const gap = this.hostLogAt === 0 ? 0 : now - this.hostLogAt
    this.hostLogAt = now
    this.hostLogSeq += 1
    this.hostLog.push(`${String(this.hostLogSeq).padStart(3, ' ')}｜+${String(gap).padStart(5, ' ')}ms｜${line}`)
    while (this.hostLog.length > 40) this.hostLog.shift()
  }

  /** 宿主時間軸——診斷用。 */
  get hostTimeline(): readonly string[] {
    return this.hostLog
  }

  private sendDocument(doc: vscode.TextDocument): void {
    this.send({
      type: 'document',
      uri: doc.uri.toString(),
      languageId: doc.languageId,
      text: doc.getText(),
      version: doc.version,
    })
  }

  /**
   * 文件變了——**而它可能是我們自己造成的**。
   *
   * 🔴 用 `version` 比對身分，**不用時間**。理由與病歷寫在 `sync/echo-guard.ts`。
   */
  private onDocumentChanged(e: vscode.TextDocumentChangeEvent): void {
    if (e.document.uri.toString() !== this.doc?.uri.toString()) {
      this.hostNote(`📝 文件變了，而**不是我們盯的那一份** → 忽略`)
      return
    }
    if (e.contentChanges.length === 0) return
    // ⚠️ 記在判定【之前】——否則被吞掉的那些一則都不會出現在紀錄裡，
    //    而那正是這份紀錄要回答的問題。
    const reason = e.reason === vscode.TextDocumentChangeReason.Undo ? '復原'
      : e.reason === vscode.TextDocumentChangeReason.Redo ? '重做' : '編輯'
    if (this.echo.isEcho(e.document.version)) {
      this.hostNote(`🔇 文件變了（${reason}，版本 ${e.document.version}）→ 判成【回音】，不送`)
      return
    }
    this.hostNote(`📝 文件變了（${reason}，版本 ${e.document.version}，${e.document.lineCount} 行）→ 送出`)
    this.sendDocument(e.document)
  }

  private onSelection(e: vscode.TextEditorSelectionChangeEvent): void {
    if (e.textEditor.document.uri.toString() !== this.doc?.uri.toString()) return
    const line = e.selections[0]?.active.line ?? 0
    if (line === this.lastSentLine) return
    this.lastSentLine = line
    this.send({ type: 'selection', line })
  }

  private async onWebviewMessage(m: WebviewMessage): Promise<void> {
    // 🔴 Webview 起來了 → **重送目前的狀態**。建面板時送的那一份可能沒有人接。
    //
    // ⚠️ 這裡曾經寫 `this.doc = undefined; this.follow()`，而那是錯的：
    //    **面板剛開時焦點就在面板上**，所以 `activeTextEditor` 是 `undefined`
    //    → `follow()` 找不到編輯器、而我又剛把 `this.doc` 清掉
    //    → 送出 `noDocument`，**把綁定解除了**。
    //    使用者要點回編輯器（第三次操作）才會恢復。
    //
    // > **「重送目前的狀態」與「重新決定狀態是什麼」是兩件事
    // > ——而後者在焦點不在編輯器上時，答案是錯的。**
    if (m.type === 'ready') { this.resend(); return }
    if (m.type === 'requestDocument') {
      // 積木那側說它的鏡像對不上 → 宿主是權威，重送。
      if (this.doc) this.sendDocument(this.doc)
      return
    }
    if (m.type === 'setLanguageCpp') { await this.setLanguageCpp(); return }
    if (m.type === 'applyEdit') { await this.applyEdit(m.span, m.baseVersion); return }
    if (m.type === 'revealNode') { this.revealNode(m.range); return }
    if (m.type === 'diagnostics') {
      // 🔴 診斷去**輸出頻道**，不去面板（FR-009）。
      // > 一個儀器如果佔著產品的版面，它就不只是儀器了。
      OUTPUT.clear()
      OUTPUT.appendLine('Semorphe 診斷')
      for (const line of m.lines) OUTPUT.appendLine(`  ${line}`)
      // 🔴 **宿主這側的時間軸也要印**——見 `hostNote` 的檔頭：
      //    面板那側的「什麼都沒收到」答不出「有沒有人送」。
      OUTPUT.appendLine('')
      OUTPUT.appendLine('  宿主時間軸（序號｜距上一則｜事件）：')
      if (this.hostLog.length === 0) OUTPUT.appendLine('    （空——文件從頭到尾沒有變過）')
      for (const line of this.hostLog) OUTPUT.appendLine(`    ${line}`)
      OUTPUT.show(true)
      return
    }
    if (m.type === 'executionAt') {
      // 🔴 **同一個機制**：執行高亮與選取高亮都是「照亮這幾行」。
      //    ⚠️ 而它用不同的 decoration，否則兩者會互相清掉。
      this.showExecution(m.range)   // ⚠️ nodeId 由 Webview 那側查成範圍
      return
    }
    if (m.type === 'viewStateChanged') {
      if (this.doc) this.viewStates.set(this.doc.uri.toString(), m.state)
      return
    }
    if (m.type === 'configChanged') {
      // 🔴 寫 **workspace** 層級——使用者拍板「面板內的選單直接改 workspace 設定」。
      // ⚠️ 而 UI 上要看得出「這會影響整個專案」（Webview 那側的責任）。
      await vscode.workspace.getConfiguration('semorphe')
        .update(m.key, m.value, vscode.ConfigurationTarget.Workspace)
      return
    }
  }

  /**
   * 積木 → 程式碼：照亮那幾行並捲到看得見。
   *
   * ⚠️ 程式碼那一側**不是我們的**，所以只能用 decoration 疊上去
   * ——而它會與其他擴充的 decoration 競爭優先序。本輪用一個低調的背景色。
   *
   * 🔴 `range` 是 `null` 代表那顆積木**指不到程式碼**（實測 1.5%）
   * ——**清掉高亮而不是靜默保留上一個**，否則使用者會以為它指到那裡。
   */
  private revealNode(range: { startLine: number; endLine: number } | null): void {
    const editor = this.editorForDoc()
    if (!editor) return
    if (range === null) { editor.setDecorations(HIGHLIGHT, []); return }
    const end = Math.min(range.endLine, editor.document.lineCount - 1)
    const r = new vscode.Range(
      new vscode.Position(range.startLine, 0),
      editor.document.lineAt(Math.max(range.startLine, end)).range.end,
    )
    editor.setDecorations(HIGHLIGHT, [r])
    // ⚠️ 只在看不見時才捲——每次都捲會讓畫面一直跳。
    editor.revealRange(r, vscode.TextEditorRevealType.InCenterIfOutsideViewport)
  }

  /** 執行走到哪一行。⚠️ 與選取高亮**分開的 decoration**，否則兩者互相清掉。 */
  private showExecution(range: { startLine: number; endLine: number } | null): void {
    const editor = this.editorForDoc()
    if (!editor) return
    if (range === null) { editor.setDecorations(EXECUTING, []); return }
    const end = Math.min(range.endLine, editor.document.lineCount - 1)
    const r = new vscode.Range(
      new vscode.Position(range.startLine, 0),
      editor.document.lineAt(Math.max(range.startLine, end)).range.end,
    )
    editor.setDecorations(EXECUTING, [r])
    editor.revealRange(r, vscode.TextEditorRevealType.InCenterIfOutsideViewport)
  }

  private editorForDoc(): vscode.TextEditor | undefined {
    const uri = this.doc?.uri.toString()
    return vscode.window.visibleTextEditors.find((ed) => ed.document.uri.toString() === uri)
  }

  /**
   * 把積木那一側算出來的範圍寫進文件。
   *
   * 🔴 **一次積木修改 = 一個復原步驟**（`undoStopBefore`／`undoStopAfter`）。
   * ⚠️ 而範圍是**整行**的：`[startLine, endLine)` → 兩個行首之間。
   */
  private async applyEdit(
    span: { startLine: number; endLine: number; lines: string[] },
    baseVersion: number,
  ): Promise<void> {
    const doc = this.doc
    // 🔴 **每一條路都要回話。** 一個「送出去而沒有任何回應」的請求，
    //    會讓 Webview 那側的樂觀更新**永遠等在半路**（它有一個 in-flight 旗標）。
    //
    // > 一個不回話的失敗，與一個還沒回話的成功，在呼叫端長得一樣。
    if (!doc) {
      this.send({ type: 'noDocument', reason: noDocumentReason(vscode.window.activeTextEditor) })
      return
    }
    // ⚠️ 這次編輯是根據舊版本算的 → 期間有外來改動，**丟掉它並重送文件**。
    //    🔴 那不是防迴圈，是防止踩掉別人的修改。
    if (doc.version !== baseVersion) {
      this.hostNote(`⏭ 積木要寫入，而它算的是版本 ${baseVersion}、現在是 ${doc.version} → 丟掉並重送`)
      this.sendDocument(doc); return
    }
    this.hostNote(`✍️ 套用積木的寫入｜${span.startLine}–${span.endLine} → ${span.lines.length} 行｜版本 ${baseVersion}`)

    const editor = vscode.window.visibleTextEditors.find(
      (ed) => ed.document.uri.toString() === doc.uri.toString())
    if (!editor) { this.sendDocument(doc); return }

    const before = doc.getText()
    const docLines = before.split('\n')

    // 🔴 **鏡像比文件長 → 那是分歧，不是「夾一下就好」。**
    //
    // > **把一個超出範圍的座標夾進範圍裡，不會讓它變成對的座標
    // > ——只會讓錯誤從「拋出來」變成「寫進檔案」。**
    if (span.startLine > docLines.length || span.endLine > docLines.length) {
      this.sendDocument(doc)   // 讓積木那側重新對齊
      return
    }

    // ─────────────────────────────────────────────────────────────
    // 🔴 **兩邊用同一個函式算出結果，再由結果反推最小的編輯範圍。**
    //
    // ## 這裡曾經自己把「行範圍」翻譯成 `vscode.Range`，而那翻譯是錯的
    //
    // ```ts
    // const range = endLine >= lineCount
    //   ? new Range(new Position(span.startLine, 0), doc.lineAt(lineCount - 1).range.end)
    //   : …
    // ```
    //
    // ⚠️ 在檔尾追加時 `span.startLine === lineCount`，而 `Position(lineCount, 0)`
    // **是一個不存在的位置**——VSCode 把它夾到檔尾，於是新的文字接在最後一行
    // **後面**而不是**下面**：
    //
    // ```cpp
    // }Serial.println();      ← 使用者 2026-08-18 在 Arduino IDE 看到的
    // ```
    //
    // 🔴 而它會**自我延續**：檔案一旦沒了結尾換行，之後每一次追加都再合併一次。
    //
    // ## 處置：不要翻譯，直接用模型算
    //
    // `applySpan` 就是積木那側算鏡像用的**同一個函式**。用它算出「應該長怎樣」，
    // 再用共同前後綴反推一次字元範圍的替換。
    //
    // > **兩邊各自把同一份規格翻譯一次，就會有兩份規格；
    // > 而它們的分歧只在資料被寫壞的時候才看得見。**
    //
    // 🟢 而它仍然是**最小編輯**（共同前後綴都保留），所以游標與復原 granularity 不變。
    // ─────────────────────────────────────────────────────────────
    const after = applySpan(before, span)
    if (before === after) {
      // 沒有差異——⚠️ 仍然要回話，否則積木那側會一直等在 in-flight。
      this.send({ type: 'applied', version: doc.version, fingerprint: textFingerprint(before) })
      return
    }
    let head = 0
    while (head < before.length && head < after.length && before[head] === after[head]) head++
    let tail = 0
    while (
      tail < before.length - head &&
      tail < after.length - head &&
      before[before.length - 1 - tail] === after[after.length - 1 - tail]
    ) tail++
    const range = new vscode.Range(
      doc.positionAt(head),
      doc.positionAt(before.length - tail),
    )
    const text = after.slice(head, after.length - tail)

    // 🔴 **把整段編輯圈起來**——文件變更事件在 `edit()` 解析【之前】就發了，
    //    所以「事後記下版本」認不出圈內那一則。見 `echo-guard.ts` 的時序陷阱。
    this.echo.beginApply()
    let ok: boolean
    try {
      ok = await editor.edit(
        (b) => b.replace(range, text),
        // 🔴 前後都下停止點 ⟹ 這一次編輯自己是一個復原步驟。
        { undoStopBefore: true, undoStopAfter: true },
      )
    } finally {
      // ⚠️ 一定要在 `finally`：一次例外讓守衛永遠開著的話，
      //    使用者之後在編輯器裡打的字**全部會被當成回音吞掉**。
      this.echo.endApply()
    }
    if (ok) {
      this.echo.remember(doc.version)
      // 🔴 **回報新的版本號。** 回音守衛擋掉了文件回送（擋得對），
      //    而如果只擋不報，Webview 的版本會永遠停在編輯前——見 `messages.ts`
      //    的 `applied`：症狀是「第一筆成功，之後每一筆都無效」。
      // 🔴 指紋讓積木那側**對得了帳**——鏡像錯位一次，之後每一段範圍都是錯的。
      this.send({ type: 'applied', version: doc.version, fingerprint: textFingerprint(doc.getText()) })
    } else {
      this.sendDocument(doc)   // ⚠️ 套用失敗要讓兩邊回到一致，不能靜默
    }
  }

  private html(): string {
    const webview = this.panel.webview
    const uri = (...parts: string[]): string =>
      webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, ...parts)).toString()
    return renderHtml({
      scriptSrc: uri(...DIST, 'webview.js'),
      // 🔴 與網頁版同一份樣式——Vite 把 `ui/style.css` 打包成這個檔。
      styleSrc: uri(...DIST, 'webview.css'),
      // ⚠️ **尾端斜線**：Blockly 直接把 `media` 當前綴接檔名。
      mediaSrc: `${uri(...MEDIA)}/`,
      csp: csp(webview.cspSource),
    })
  }

  askDiagnostics(): void {
    this.send({ type: 'requestDiagnostics' })
  }

  reveal(column: vscode.ViewColumn): void {
    this.panel.reveal(column)
  }

  dispose(): void {
    const ed = this.editorForDoc()
    ed?.setDecorations(HIGHLIGHT, [])
    ed?.setDecorations(EXECUTING, [])
    for (const d of this.disposables) d.dispose()
    current = undefined
  }
}

/** 讓指令問得到目前的面板。⚠️ 沒有面板時什麼都不做——**而要說得出來**。 */
export function requestDiagnostics(): void {
  if (!current) {
    OUTPUT.appendLine('Semorphe 診斷：面板還沒打開')
    OUTPUT.show(true)
    return
  }
  current.askDiagnostics()
}

export function openBlocksPanel(context: vscode.ExtensionContext): void {
  const column = vscode.window.activeTextEditor
    ? vscode.ViewColumn.Beside
    : vscode.ViewColumn.One

  if (current) { current.reveal(column); return }

  const panel = vscode.window.createWebviewPanel(VIEW_TYPE, TITLE, column, {
    enableScripts: true,
    // ⚠️ 收起來再打開**不要重建**——重建等於重新載入 200 顆膠囊 ＋ 重新 inject。
    retainContextWhenHidden: true,
    localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, ...DIST)],
  })
  const session = new SemorpheSession(panel, context.extensionUri, context.workspaceState)
  current = session
  panel.onDidDispose(() => session.dispose(), null, context.subscriptions)
}

/**
 * 把宿主的 `Memento` 包成注入用的介面。
 *
 * ⚠️ **`ViewStateStore` 刻意不認識 `vscode`**——那個模組在測試環境不存在，
 * 而身分搬遷的邏輯必須測得到。
 */
function mementoStore(memento: vscode.Memento): KeyValueStore {
  return {
    get: (k) => memento.get<ViewState>(k),
    set: (k, v) => void memento.update(k, v),
    keys: () => memento.keys(),
  }
}

/** ⚠️ 匯出給測試用——套用語義必須與 `applySpan` 一致，否則測試綠而檔案壞。 */
export { applySpan }
