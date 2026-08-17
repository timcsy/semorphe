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
import { applySpan } from '../core/projection/rewrite-span'
import type { HostMessage, WebviewMessage } from './sync/messages'

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

  constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel
    this.extensionUri = extensionUri
    this.panel.webview.html = this.html()

    this.panel.webview.onDidReceiveMessage(
      (m: WebviewMessage) => void this.onWebviewMessage(m), null, this.disposables)

    // 跟著 active editor 走
    vscode.window.onDidChangeActiveTextEditor(() => this.follow(), null, this.disposables)
    vscode.workspace.onDidChangeTextDocument((e) => this.onDocumentChanged(e), null, this.disposables)

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
    if (!doc) { this.send({ type: 'noDocument' }); return }
    this.sendDocument(doc)
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

  private async onWebviewMessage(m: WebviewMessage): Promise<void> {
    if (m.type === 'applyEdit') await this.applyEdit(m.span, m.baseVersion)
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
    if (!doc) return
    // ⚠️ 這次編輯是根據舊版本算的 → 期間有外來改動，**丟掉它並重送文件**。
    //    🔴 那不是防迴圈，是防止踩掉別人的修改。
    if (doc.version !== baseVersion) { this.sendDocument(doc); return }

    const editor = vscode.window.visibleTextEditors.find(
      (ed) => ed.document.uri.toString() === doc.uri.toString())
    if (!editor) return

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
    if (ok) this.echo.remember(doc.version)
    else this.sendDocument(doc)   // ⚠️ 套用失敗要讓兩邊回到一致，不能靜默
  }

  private html(): string {
    const webview = this.panel.webview
    const uri = (...parts: string[]): string =>
      webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, ...parts)).toString()
    return renderHtml({
      scriptSrc: uri(...DIST, 'webview.js'),
      // ⚠️ **尾端斜線**：Blockly 直接把 `media` 當前綴接檔名。
      mediaSrc: `${uri(...MEDIA)}/`,
      csp: csp(webview.cspSource),
    })
  }

  reveal(column: vscode.ViewColumn): void {
    this.panel.reveal(column)
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose()
    current = undefined
  }
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
  const session = new SemorpheSession(panel, context.extensionUri)
  current = session
  panel.onDidDispose(() => session.dispose(), null, context.subscriptions)
}

/** ⚠️ 匯出給測試用——套用語義必須與 `applySpan` 一致，否則測試綠而檔案壞。 */
export { applySpan }
