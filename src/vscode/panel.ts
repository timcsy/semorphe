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
import { ViewStateStore, type KeyValueStore, type ViewState } from './sync/view-state'
import { applySpan } from '../core/projection/rewrite-span'
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
  if (!editor) return '沒有開啟任何程式碼編輯器。開一個 .ino 或 .cpp 檔。'
  const doc = editor.document
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

    this.follow()
  }

  private send(m: HostMessage): void {
    void this.panel.webview.postMessage(m)
  }

  /** 切到目前的編輯器所編輯的文件。 */
  private follow(): void {
    const editor = vscode.window.activeTextEditor
    const doc = editor && isSupported(editor.document) ? editor.document : undefined
    if (doc?.uri.toString() === this.doc?.uri.toString()) return
    this.doc = doc
    // ⚠️ 換文件就清空回音——上一份文件的版本號與這一份無關。
    this.echo.reset()
    if (!doc) { this.send({ type: 'noDocument', reason: noDocumentReason(editor) }); return }
    this.lastUri = doc.uri.toString()
    this.sendConfig()
    this.sendDocument(doc)
    const vs = this.viewStates.get(doc.uri.toString())
    if (vs) this.send({ type: 'viewState', state: vs })
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
    this.send({ type: 'config', config: resolveConfig(raw) })
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
    if (e.document.uri.toString() !== this.doc?.uri.toString()) return
    if (e.contentChanges.length === 0) return
    if (this.echo.isEcho(e.document.version)) return
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
    if (m.type === 'applyEdit') { await this.applyEdit(m.span, m.baseVersion); return }
    if (m.type === 'revealNode') { this.revealNode(m.range); return }
    if (m.type === 'diagnostics') {
      // 🔴 診斷去**輸出頻道**，不去面板（FR-009）。
      // > 一個儀器如果佔著產品的版面，它就不只是儀器了。
      OUTPUT.clear()
      OUTPUT.appendLine('Semorphe 診斷')
      for (const line of m.lines) OUTPUT.appendLine(`  ${line}`)
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
    if (doc.version !== baseVersion) { this.sendDocument(doc); return }

    const editor = vscode.window.visibleTextEditors.find(
      (ed) => ed.document.uri.toString() === doc.uri.toString())
    if (!editor) { this.sendDocument(doc); return }

    const lineCount = doc.lineCount
    const endLine = Math.min(span.endLine, lineCount)
    const range = endLine >= lineCount
      // 覆蓋到檔尾——用文件的實際結尾，避免造出不存在的位置
      ? new vscode.Range(new vscode.Position(span.startLine, 0), doc.lineAt(lineCount - 1).range.end)
      : new vscode.Range(new vscode.Position(span.startLine, 0), new vscode.Position(endLine, 0))
    const text = endLine >= lineCount
      ? span.lines.join('\n')
      : span.lines.map((l) => `${l}\n`).join('')

    const ok = await editor.edit(
      (b) => b.replace(range, text),
      // 🔴 前後都下停止點 ⟹ 這一次編輯自己是一個復原步驟。
      { undoStopBefore: true, undoStopAfter: true },
    )
    if (ok) {
      this.echo.remember(doc.version)
      // 🔴 **回報新的版本號。** 回音守衛擋掉了文件回送（擋得對），
      //    而如果只擋不報，Webview 的版本會永遠停在編輯前——見 `messages.ts`
      //    的 `applied`：症狀是「第一筆成功，之後每一筆都無效」。
      this.send({ type: 'applied', version: doc.version })
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
