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
import type { VscodeViewKind } from './vscode-profile'
import { layoutPreset, type LayoutPresetId } from '../core/host/layout-presets'
import type { UnderstandingLayer } from '../core/view-host'
import { EchoGuard } from './sync/echo-guard'
import { resolveConfig, type RawSettings } from './sync/settings'
import { textFingerprint } from './sync/fingerprint'
import { applySpan } from '../core/projection/rewrite-span'
import { ViewStateStore, type KeyValueStore, type ViewState } from './sync/view-state'
import { DocPrefStore, DOC_PREF_KEYS, type PrefStore, type DocPrefs } from './sync/doc-prefs'
import type { HostMessage, WebviewMessage, ControlStateWire, CodeDiagnosticWire } from './sync/messages'

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

/**
 * 🔴 **診斷的家是 IDE 的 Problems，不是面板裡的一塊**（2026-08-25）。
 *
 * `draft/版面與檔案` §六之六：VSCode 把「狀態層」拆成四個原生的家，
 * 而診斷那一格是 `DiagnosticCollection`。接上之後：錯誤進 Problems、
 * 檔案總管標紅、`F8` 逐個跳——**那些是使用者已經會的操作**。
 */
const DIAGNOSTICS = vscode.languages.createDiagnosticCollection('semorphe')

/**
 * 每一種投影一個 viewType 與一個標題。
 *
 * ⚠️ `viewType` 進 `activeWebviewPanelId`（`manifest.ts` 的 `when` 用它），
 * 所以它**不能兩種共用**——共用的話標題列的按鈕會出現在錯的面板上。
 */
const VIEW_TYPES: Record<VscodeViewKind, string> = {
  blocks: 'semorphe.blocks',
  flow: 'semorphe.flow',
  state: 'semorphe.console',
}
const TITLES: Record<VscodeViewKind, string> = {
  blocks: 'Semorphe 積木',
  flow: 'Semorphe 流程',
  // ⚠️ 這一格是**兩個分頁**（主控台／變數）——標題寫層的名字會太抽象，
  //    所以寫使用者按下去最常要的那一個。
  state: 'Semorphe 主控台',
}
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
 * 🪦 **單例退場**（2026-09-01）。使用者：「我原本的期待是能不能
 * **把面板都獨立出來**？」
 *
 * ## 為什麼它可以退場
 *
 * 舊註解說「多面板要先把 per-document 的狀態分乾淨」——而查證之後，
 * **那些狀態本來就分乾淨了**：真相是那份文件，每個面板各自 lift 它、
 * 各自送 `applyEdit` 回去，而「多個寫入者」的對帳機制（`EchoGuard` ＋
 * `textFingerprint`）**今天就在跑**（編輯器 ＋ 面板已經是兩個寫入者）。
 *
 * > **P1 說投影是【純函數】——所以每個面板要的協定都一樣：文字進、編輯出。
 * > 而一份已經支援兩個寫入者的協定，支援三個不需要新東西。**
 *
 * ⚠️ 對照組就在這個檔裡：`VariablesView` 是**被餵的**，它有自己一份
 * `reportVariables` schema，而餵它的面板關掉之後**沒有人清它**
 * ——它停在最後一筆，看起來完全正常。
 *
 * > **一個必須被餵才畫得出來的視圖，它不是在投影。**
 *
 * ## 🔴 而「哪些東西是全域的」要數清楚
 *
 * 同步狀態列、控制項狀態列、終端機、Problems ——這四樣**一份就好**，
 * 由**最後看過的那個面板**說話。所以下面有兩個東西：一張登錄表，
 * 與一個 `active` 指標。
 */
const sessions = new Map<VscodeViewKind, SemorpheSession>()

/**
 * 全域 chrome（狀態列／終端機／診斷）目前聽誰的。
 *
 * ⚠️ **它不是「最後開的」，是「最後看的」**——使用者按狀態列上那顆
 * 「骨架」時，他心裡想的是**他正在看的那個面板**。
 */
let active: SemorpheSession | undefined

/**
 * 開過面板的那個 context。
 *
 * ⚠️ 套版面時可能要**補開**一個還沒開的面板，而 `openPanel` 需要它。
 * 🔴 它不是「隨手存起來的全域」：這個擴充一個 process 只有一個 context，
 *    而 `activate` 之前沒有人叫得到這裡。
 */
let extensionContext: vscode.ExtensionContext | undefined

/**
 * **一個 session 需要宿主給它的全部**（2026-09-02，spec 171）。
 *
 * 🔴 它刻意只有兩件事：一個 `webview`，與一個「**把我叫出來**」。
 * `WebviewPanel`（編輯器區的分頁）逐字滿足它；`WebviewView`（panel 區的視圖）
 * 用兩行包一下也滿足它——而 `SemorpheSession` 整支**不必知道自己住在哪**。
 *
 * > **一個視圖如果知道自己住在編輯器區還是 panel 區，那件事就會滲進它每一個方法。**
 */
interface SessionSurface {
  readonly webview: vscode.Webview
  /** ⚠️ panel 區的視圖沒有「欄」的概念——它會忽略這個參數。 */
  reveal(column?: vscode.ViewColumn): void
}

class SemorpheSession {
  private readonly panel: SessionSurface
  private readonly extensionUri: vscode.Uri
  private readonly disposables: vscode.Disposable[] = []
  private readonly echo = new EchoGuard()
  /** 目前服務的文件。⚠️ 沒有支援的編輯器時是 `undefined`。 */
  private doc: vscode.TextDocument | undefined
  /** 🔴 選取的防迴圈：值相等就不再傳播（選取是冪等的）。 */
  private lastSentLine = -1
  private readonly viewStates: ViewStateStore
  /** 這份文件上使用者選過什麼——⚠️ **所有面板共用一份**（宿主的 workspaceState）。 */
  private readonly docPrefs: DocPrefStore
  /** ⚠️ 上一份文件的 uri——存檔那一刻要靠它做身分搬遷。 */
  private lastUri: string | undefined

  /** 這個面板畫哪一層。⚠️ 它決定 `data-view`、分頁標題與登錄表的鍵。 */
  readonly kind: VscodeViewKind

  constructor(panel: SessionSurface, extensionUri: vscode.Uri, memento: vscode.Memento,
    kind: VscodeViewKind = 'blocks') {
    this.panel = panel
    this.kind = kind
    this.extensionUri = extensionUri
    this.viewStates = new ViewStateStore(mementoStore(memento))
    this.docPrefs = new DocPrefStore(prefStore(memento))
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
    // ⚠️ 使用者在這份文件上選過的，**壓在設定檔之上**——他剛剛按的那一下
    //    比一份放在那裡的預設更明確。
    const prefs = doc ? this.docPrefs.get(doc.uri.toString()) : {}
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
      skeleton: layered<string>('skeleton'),
      scaffold: layered<string>('scaffold'),
      style: layered<string>('style'),
      blockStyle: layered<string>('blockStyle'),
      locale: layered<string>('locale'),
    }
    // 🔴 傳檔名進去——`.ino` 的預設目標是 Arduino，不是 C++（見 `settings.ts`）。
    // ⚠️ `languageId` 也要傳——暫存分頁**沒有副檔名**，那時只有它說得出這是什麼。
    const resolved = resolveConfig(raw, doc?.uri.path, vscode.env.language, doc?.languageId)
    // 🔴 **這份文件上選過的壓在最上面**——見 `configChanged` 那一段。
    //    ⚠️ 用 `??` 而不是展開：`prefs` 的每一格都是選填，展開會把
    //       `undefined` 蓋掉解析好的值。
    this.send({
      type: 'config',
      config: {
        ...resolved,
        targetId: prefs.targetId ?? resolved.targetId,
        topicId: prefs.topicId ?? resolved.topicId,
        styleId: prefs.styleId ?? resolved.styleId,
        skeletonId: prefs.skeletonId ?? resolved.skeletonId,
        scaffoldMode: prefs.scaffoldMode ?? resolved.scaffoldMode,
        // ⚠️ **使用者在這份文件上選過的話，就不必再問文件自己說什麼**
        //    ——他的選擇比推導更明確。
        autoTargetId: prefs.targetId ? undefined : resolved.autoTargetId,
      },
    })
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
    if (m.type === 'syncPhase') { updateSyncStatusBar(m.phase, m.source, m.detail); return }
    if (m.type === 'controls') {
      // 🔴 **記在自己名下**，而不是覆蓋一份全域的——見 `statesBySession`。
      statesBySession.set(this.kind, m.items)
      if (active === this) updateControlSurfaces(m.items)
      return
    }
    if (m.type === 'problems') { this.publishDiagnostics(m.items); return }
    // 🪦 `console` 與 `variables` 這兩則**不再有宿主端的消費者**（2026-09-01）。
    //
    // 🔴 主控台與變數是 `state` 面板裡的兩個分頁，而那個面板自己畫它們——
    //    **沒有東西要跨過這條線**。而「兩個面板搶一台終端機，輸入該給誰」
    //    那個問題跟著整個消失。
    //
    // ⚠️ 訊息本身留著不接：webview 那側在 `output` 投影到 `panelBottom` 時
    //    根本不送它們，而**收到了也只是舊版的 webview**——靜靜地丟掉，
    //    比拋錯好（一個舊面板不該讓宿主壞掉）。
    if (m.type === 'console' || m.type === 'variables') return
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
      // 🔴 **寫回的範圍不得大於它描述的東西**（2026-09-01）。
      //
      //    使用者開一份 C++ 的暫存檔，而狀態列寫著「Arduino（不指定板子）」
      //    ——「**C++ 一開始要預設 C++ 吧**」。而那是前一刀弄壞的：
      //    每顆 picker 選完就寫 **workspace 設定**，於是一次「我這個檔要用
      //    Arduino」變成了整個專案的設定，把「依副檔名自動判斷」蓋掉。
      //
      // > **一份偏好寫回去的範圍，不得大於它描述的東西
      // > ——把「這個檔」寫成「這個專案」，它就會去回答它沒被問到的問題。**
      //
      //    目標／骨架／鷹架／風格／課程 **描述這份文件** → 進 per-uri 的
      //    偏好儲存體（宿主的 workspaceState，所有面板共用）。
      //    積木外觀／語系 **描述這個人** → 才進設定檔。
      const field = DOC_PREF_KEYS[m.key]
      if (field && this.doc) {
        this.docPrefs.merge(this.doc.uri.toString(), { [field]: m.value })
        return
      }
      if (field) return   // 還沒綁文件 ⟹ 沒有地方記，而**寫成全域是錯的**
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
      // 🔴 **這個面板畫哪一層**——webview 一啟動就讀它（見 `webview/main.ts`）。
      view: this.kind,
    })
  }

  askDiagnostics(): void {
    this.send({ type: 'requestDiagnostics' })
  }

  /** 把同步指令送進 webview——三態的機制住在那裡（`core/sync-coordinator.ts`） */
  sendSync(cmd: { action: 'pause' | 'resume' | 'use'; viewId?: string }): void {
    this.send({ type: 'syncCommand', ...cmd })
  }

  /**
   * 診斷 → **IDE 的 Problems**（2026-08-25）。
   *
   * > **搬面板只是換了個位置；走管道才拿得到 F8、紅色波浪線、
   * > 檔案總管上的紅點，以及使用者已經會的每一個快捷鍵。**
   *
   * ⚠️ `endColumn` 是 `null` 時代表「到行尾」——**只有這裡知道行尾在哪**，
   * 因為文件在主行程。webview 那側不猜。
   */
  private publishDiagnostics(items: CodeDiagnosticWire[]): void {
    const doc = this.doc
    if (!doc) return
    const out = items.map((d) => {
      const endLine = Math.min(d.endLine, doc.lineCount - 1)
      const endColumn = d.endColumn ?? doc.lineAt(Math.max(0, endLine)).text.length
      const diag = new vscode.Diagnostic(
        new vscode.Range(d.startLine, d.startColumn, endLine, endColumn),
        d.message,
        d.severity === 'error' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning,
      )
      // 🔴 具名來源——Problems 上會顯示 `semorphe`，而**使用者要分得出
      //    這一條是誰報的**（同一個檔可能同時有 C/C++ 擴充的診斷）。
      diag.source = 'Semorphe'
      return diag
    })
    DIAGNOSTICS.set(doc.uri, out)
  }

  /** 🔴 這個宿主打不開終端機——請面板自己畫主控台。 */
  sendConsoleFallback(): void {
    this.send({ type: 'consoleFallback' })
  }

  /** 終端機打的一行 → webview。 */
  sendConsoleInput(line: string): void {
    this.send({ type: 'consoleInput', line })
  }

  /** 宿主那側按了控制項——原封不動送進 webview。 */
  sendControl(msg: Extract<HostMessage, { type: 'controlInvoke' }>): void {
    this.send(msg)
  }

  reveal(column?: vscode.ViewColumn): void {
    this.panel.reveal(column)
  }

  /** 目前服務的文件——套版面時要把它 reveal 到程式碼那一組。 */
  get document(): vscode.TextDocument | undefined {
    return this.doc
  }

  dispose(): void {
    const ed = this.editorForDoc()
    ed?.setDecorations(HIGHLIGHT, [])
    ed?.setDecorations(EXECUTING, [])
    for (const d of this.disposables) d.dispose()
    sessions.delete(this.kind)
    statesBySession.delete(this.kind)
    if (active === this) { active = [...sessions.values()][0]; renderActiveControls() }
    // 🔴 **全域 chrome 只在【最後一個】面板關掉時收**（2026-09-01）。
    //
    //    ⚠️ 舊碼在任何一個面板關掉時就收——單例時代那是對的，
    //    而多面板時它會在關掉流程面板的瞬間，把還開著的積木面板的
    //    狀態列、終端機與 Problems 一起抹掉。
    //
    // > **「我關了」與「大家都關了」是兩件事——而在只有一個的時候
    // > 它們剛好同時成立，於是那份混用不會被發現。**
    if (sessions.size > 0) return
    // 🔴 **面板關了就沒有東西在同步了**——而狀態列項目建好之後從來沒有人藏它，
    //    於是它會繼續說「⇄ 同步中」，指著一個已經不存在的面板。
    //
    // > **一個在說謊的狀態指示器，比沒有那個指示器更糟：
    // > 它讓人停止確認。**
    hideSyncStatusBar()
    hideControlSurfaces()
    // 🔴 面板關了，診斷也不該留在 Problems 上——**它們是這個面板算出來的**。
    if (this.doc) DIAGNOSTICS.delete(this.doc.uri)
  }
}

/**
 * 同步三態的狀態列項目。
 *
 * 🔴 **它住在主行程而不是 webview**——狀態列是**宿主都有的 chrome**
 * （VSCode／Theia／網頁版），而我們自己畫在面板裡的工具列不是。
 * 使用者 2026-08-25：「全域，**不放在面板裡面的**」。
 *
 * ⚠️ 而「暫停中必須看得見」是這一刀的驗收——一個沒被顯示的狀態，
 * 使用者會當成壞掉。
 */
/**
 * ⚠️ 指令 id 定在**這裡**而不是 `extension.ts`：狀態列項目要用它，
 * 而 `extension.ts` import 這個檔——反過來會是循環相依。
 */
export const SYNC_MENU_COMMAND = 'semorphe.syncMenu'

let syncItem: vscode.StatusBarItem | undefined

function updateSyncStatusBar(phase: 'live' | 'paused' | 'diverged', source: string | null, detail: string): void {
  if (!syncItem) {
    syncItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
    syncItem.command = SYNC_MENU_COMMAND
  }
  const text =
    phase === 'paused' ? '$(debug-pause) 同步：已暫停'
      : phase === 'diverged' ? '$(warning) 同步：兩邊都改了'
        : `$(sync) 同步中${source ? `（${source}）` : ''}`
  syncItem.text = text
  // 🔴 **常駐顯示三態，其餘進 tooltip**（P4 漸進揭露）——面板不畫狀態列了，
  //    而語言／風格／主題／語系那幾格**不是丟掉，是換一層揭露**。
  // ⚠️ **Theia 把 `\n` 吃掉**（2026-08-25 兩邊對照截圖：VSCode 兩行、Arduino IDE 一行）
  //    ——所以提示前面留一個分隔號，**擠成一行時仍然讀得斷**。
  //
  // > **一個只在其中一個宿主排得好看的字串，
  // > 在另一個宿主是黏在一起的一句話。**
  syncItem.tooltip = `${detail}\n— 點一下開同步選單`
  // ⚠️ 分岔要**看得出來不一樣**——它不是一個更花俏的「同步中」
  syncItem.backgroundColor = phase === 'diverged'
    ? new vscode.ThemeColor('statusBarItem.warningBackground')
    : undefined
  syncItem.show()
}

/**
 * 投影到宿主的控制項 —— **狀態列的 picker ＋ 標題列的動作**。
 *
 * ## 為什麼值域也從 webview 送過來
 *
 * 主行程**不認得**目標登錄表、風格預設、語系清單、層級樹。
 * 讓它認得，就是把那幾份真相搬到第二個地方——而它們會漂移。
 *
 * > **主行程知道「有一顆叫做 target 的 picker」就夠了；
 * > 「它有哪些值」永遠是 webview 的事。**
 */
const controlItems = new Map<string, vscode.StatusBarItem>()
let controlStates: ControlStateWire[] = []

/**
 * **每個面板各自的那一份**——狀態列畫的是「你正在看的那個」。
 *
 * 🔴 2026-09-01 實測。使用者：「**為何出現的是 Arduino 的？跟下面寫的不一樣啊**」
 * ——三個面板的工具箱都是 Arduino，而狀態列寫著「C++ 標準骨架・完整」。
 *
 * 舊碼是一個全域的 `controlStates`，而**任何一個面板送來就覆蓋它**：
 *
 * ```
 * 積木面板 開機 → 送預設（C++）→ 收到組態 → 送 Arduino
 * 流程面板 開機 → 送預設（C++）→ 收到組態 → 送 Arduino
 * 主控台   開機 → 送預設（C++）← 這一則【最後到】，於是狀態列停在它身上
 * ```
 *
 * > **一個「最後說話的人贏」的全域狀態，在只有一個說話者的時候看起來像
 * > 「唯一真相」——多一個說話者，它就變成一場競賽。**
 *
 * 🟢 處置：一個面板一份，而狀態列問 `active`。切面板時重畫。
 */
const statesBySession = new Map<VscodeViewKind, ControlStateWire[]>()

/** 重畫狀態列——畫的是**目前看著的那個面板**的那一份。 */
function renderActiveControls(): void {
  const items = active ? statesBySession.get(active.kind) : undefined
  if (items) updateControlSurfaces(items)
}

function updateControlSurfaces(items: ControlStateWire[]): void {
  controlStates = items
  const seen = new Set<string>()
  // ⚠️ 由後往前給優先序，讓它們在狀態列上的順序與登錄表一致
  //    （VSCode 的右側是優先序愈大愈靠左）。
  items.filter((i) => i.kind === 'picker').forEach((item, index) => {
    seen.add(item.id)
    let bar = controlItems.get(item.id)
    if (!bar) {
      bar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99 - index)
      bar.command = { command: `semorphe.control.${item.id}`, title: item.title }
      controlItems.set(item.id, bar)
    }
    bar.text = item.label
    bar.tooltip = `${item.title}\n— 點一下更換`
    bar.show()
  })
  // 🔴 **不再出現的要收起來**——一個指著不存在的東西的狀態列項目在說謊。
  for (const [id, bar] of controlItems) if (!seen.has(id)) bar.hide()
}

/** 面板關了：控制項也不該留在狀態列上。 */
function hideControlSurfaces(): void {
  for (const bar of controlItems.values()) bar.hide()
  controlStates = []
}

/**
 * 使用者點了狀態列上的某一顆 picker。
 *
 * ⚠️ 沒有面板時要**說得出來**，不得靜默——與 `openSyncMenu` 同一條。
 */
/**
 * 一顆 **picker** 選好之後，要送給誰。
 *
 * 🔴 **每一個面板**（2026-09-01）。使用者：「**為何出現的是 Arduino 的？
 * 跟下面寫的不一樣啊**」——三個面板的工具箱是 Arduino，而狀態列寫著 C++。
 *
 * picker 那一排說的全部是**這份文件與這個人的偏好**：目標板子、骨架、風格、
 * 積木風格、語系、課程、範例、版面。**它們不屬於某一個面板**。
 *
 * ⚠️ 而舊碼只送給 `active`——單例時代那沒有差別，多面板時它變成
 * 「選一次只套到一個」，而另外兩個**繼續用舊的畫**、繼續公佈舊的狀態。
 *
 * > **一個設定如果描述的是【文件】，那它就不能只送給【其中一個看它的人】。**
 *
 * 🔴 而 **action 不能廣播**（`invokeControl` 那一支）：還原／重做／清空／執行
 * 作用在語義樹上，廣播出去就是做三次。
 *
 * > **問「這件事屬於誰」——屬於文件的廣播，屬於這一次操作的只給發話的那個。**
 */
function broadcastControl(id: string, value?: string, values?: string[]): void {
  for (const s of sessions.values()) {
    s.sendControl(values
      ? { type: 'controlInvoke', id, values }
      : { type: 'controlInvoke', id, value })
  }
}

export async function pickControl(id: string): Promise<void> {
  if (!active) {
    OUTPUT.appendLine(`Semorphe 控制項「${id}」：面板還沒打開`)
    OUTPUT.show(true)
    return
  }
  const state = controlStates.find((c) => c.id === id)
  if (!state?.options) {
    // 🔴 沒有值域就**不要開一個空的選單**——空選單看起來像壞掉。
    OUTPUT.appendLine(`Semorphe 控制項「${id}」：面板還沒送來值域`)
    OUTPUT.show(true)
    return
  }
  // ⚠️ `value` 是選填的——分隔列（`QuickPickItemKind.Separator`）沒有值。
  type Item = vscode.QuickPickItem & { value?: string }
  if (state.multi) {
    // ⚠️ 多選這一支也要分組——主題樹的 `group` 就是它的上層節點。
    const items: Item[] = []
    let g: string | undefined
    for (const o of state.options) {
      if (o.group && o.group !== g) {
        items.push({ label: o.group, kind: vscode.QuickPickItemKind.Separator })
      }
      g = o.group
      items.push({
        label: o.label, value: o.value, description: o.description,
        picked: state.picked?.includes(o.value) ?? false,
      })
    }
    const picked = await vscode.window.showQuickPick<Item>(items, { title: state.title, canPickMany: true })
    if (!picked) return
    // ⚠️ 分隔列沒有值——濾掉，而不是送出 `undefined`。
    broadcastControl(id, undefined, picked.map((p) => p.value).filter((v): v is string => v !== undefined))
    return
  }
  // 🔴 **分組要畫出來**（2026-09-01）。使用者：「沒有辦法區分骨架和顯示，
  //    像是網頁版就可以」——而骨架那顆選單裡是**兩件事**：
  //
  //    ```
  //    骨架  C++ 標準骨架／沒有骨架／Arduino 骨架   ← 選哪一個框架
  //    顯示  隱藏／淡的／完整                       ← 那個框架給不給看
  //    ```
  //
  //    攤平之後「Arduino 骨架」與「淡的」是同一層的五個選項，
  //    ⚠️ 而它們**不互斥**——挑一個「顯示」不會取消骨架。一張平的清單在說謊。
  //
  // > **一份選單如果攤平了兩個維度，它就把「而且」畫成了「或者」。**
  const items: Item[] = []
  let group: string | undefined
  for (const o of state.options) {
    // ⚠️ 組名換的時候插一列標題——分隔列不可選，也不佔鍵盤導覽的位置。
    if (o.group && o.group !== group) {
      items.push({ label: o.group, kind: vscode.QuickPickItemKind.Separator })
    }
    group = o.group
    items.push({
      label: o.label, value: o.value,
      // ⚠️ 目前值標一個記號——QuickPick 沒有「目前選中」的原生表達。
      // 🔴 而它**不能佔掉 `description`**：那一格是那一項的說明
      //    （「#include + int main() + return 0」），網頁版兩者並排。
      description: [o.description, o.value === state.value ? '· 目前' : '']
        .filter(Boolean).join('  ') || undefined,
    })
  }
  const choice = await vscode.window.showQuickPick<Item>(items, { title: state.title })
  // ⚠️ 分隔列沒有 `value`——雖然它選不到，型別上仍要擋住。
  if (!choice?.value) return
  // 🔴 **版面由【擁有版面的人】執行**（2026-09-01）。
  //
  //    面板獨立出來之後，「哪一格放什麼」是 VSCode 的編輯器分組，不是我們的
  //    grid——所以這一顆**不轉回 webview**，它在這裡就地執行。
  //
  //    ⚠️ 而**詞彙仍然住在核心**（四張版面、它們的名字、它們的 `areas`）：
  //       webview 送過來的那份值域就是宣告本身，這裡只負責翻譯與執行。
  //
  // > **一個控制項的【名字】與它的【執行者】可以住在不同的地方
  // > ——而讓它們住在同一個地方，就是把宿主的知識搬進核心。**
  if (id === 'layout') { await applyEditorLayout(choice.value); return }
  broadcastControl(id, choice.value)
}

/**
 * **套一張版面——把每一格顯示到它那一欄**（spec 171，2026-09-02）。
 *
 * ## 🪦 這一支從 127 行縮成這樣
 *
 * 它曾經有：版面 → 編輯器分組的推導（`editor-layout.ts`，142 行）、
 * `vscode.setEditorLayout`、分割指令的退路（`arrangeBySplitting`）、
 * 能力探測（`detectLayoutCaps`）、以及「新那一組的號碼要用問的」。
 *
 * 🔴 **那一整疊只為了一件事：讓編輯區能有第二列。**
 * 而需要第二列的只有十字，而十字需要第二列**只因為主控台在編輯區裡**。
 *
 * 主控台搬去底下（宿主的 panel 區）之後，三張版面**全是純欄**
 * ——`reveal(ViewColumn)` 就排得出來，而**三個宿主都做得到**。
 *
 * > **我一直在問「怎麼讓這個宿主做到 X」，
 * > 而正確的問題是「為什麼我們需要 X」。**
 *
 * ⚠️ 順序仍然重要：**該開的先開**，否則那一欄會是空的。
 */
async function applyEditorLayout(presetId: string): Promise<void> {
  const preset = layoutPreset(presetId as LayoutPresetId)
  if (!preset || !extensionContext) return
  // ⚠️ 「專注」的 `*` 跟著**目前這個面板**走——它就是使用者正在看的那一層。
  const focus: UnderstandingLayer = active?.kind === 'flow' ? 'relation' : 'space'
  const cols = preset.areas[0].map((v) => (v === '*' ? focus : v))

  const KIND_OF: Partial<Record<UnderstandingLayer, VscodeViewKind>> = {
    relation: 'flow', space: 'blocks',
  }
  // 該開的先開。
  for (const layer of cols) {
    const kind = KIND_OF[layer]
    if (kind && !sessions.has(kind)) openPanel(extensionContext, kind)
  }
  // 各自就位——第 j 欄就是 `ViewColumn` j+1（不存在的欄會長出來）。
  const doc = active?.document
  for (const [j, layer] of cols.entries()) {
    if (layer === 'element') {
      if (doc) await vscode.window.showTextDocument(doc, { viewColumn: j + 1, preserveFocus: true })
      continue
    }
    const kind = KIND_OF[layer]
    if (kind) sessions.get(kind)?.reveal(j + 1)
  }

  // 🔴 **告訴面板它現在是哪一張**——不然狀態列上那顆會停在上一個名字。
  broadcastControl('layout', presetId)
}

/** 標題列按了一個動作（含執行模式）。 */
export function invokeControl(id: string, value?: string): void {
  if (!active) {
    OUTPUT.appendLine(`Semorphe 動作「${id}」：面板還沒打開`)
    OUTPUT.show(true)
    return
  }
  active.sendControl({ type: 'controlInvoke', id, value })
}

/**
 * 🪦 **終端機那條路整條退場**（2026-09-01）—— 268 行、7 個全域狀態。
 *
 * 使用者：「或許，semorphe 的主控台**不一定要用原生的**。」
 *
 * 這裡曾經有：一台偽終端機（`ensureTerminal`／`probeTerminal`）、一份唯讀的
 * 虛擬文件（`semorphe-console:` scheme）當作終端機開不起來時的退路、
 * 一顆 `showInputBox` 當作那個退路也要讀 `cin` 時的退路、一個
 * `consoleMode: 'terminal' | 'editor'` 記著現在走哪一條，以及 `consoleOwner`
 * （兩個面板搶一台終端機時，輸入該給誰）。
 *
 * 🔴 **那一整疊都在補同一個坑**：宿主的輸出格是唯讀的，而我們的程式要讀
 * `cin`。面板獨立出來之後，主控台是我們自己的一個 webview——它有輸入框。
 *
 * > **一條為了繞過某個限制而生的路，在限制消失之後不會自己消失
 * > ——它會變成「本來就這樣」。**
 *
 * ⚠️ 同一段裡的 `VariablesView` 也一起走：它是一個**被餵的**薄視圖，有自己
 * 一份 `reportVariables` schema，而餵它的面板關掉之後**沒有人清它**
 * ——它停在最後一筆，看起來完全正常。
 *
 * 🟢 而它們沒有被丟掉：它們是 `state` 面板裡的兩個分頁，
 * **與網頁版逐格相同的那一份**（`ui/panels/console-panel.ts`）。
 */
export function showConsole(): void {
  if (extensionContext) openPanel(extensionContext, 'state')
}

// 🪦 `registerConsoleDocument` 與 `registerVariablesView` **一起退場**。
//
// ⚠️ 我原本把它們留成兩個空殼「讓呼叫端還編得過」——而第三十八條護欄當場
//    抓到（空殼 2，基線 0）。它是對的：
//
// > **一個「留著給呼叫者」的空殼不是相容性，是欠款
// > ——而它會讓下一個人以為那件事還在做。**


/** 面板關了：狀態列不得繼續宣稱有東西在同步。 */
function hideSyncStatusBar(): void {
  syncItem?.hide()
}

/** 主行程 → webview 的同步指令。⚠️ 沒有面板時要說得出來，不得靜默 */
export async function openSyncMenu(): Promise<void> {
  if (!active) {
    OUTPUT.appendLine('Semorphe 同步：面板還沒打開')
    OUTPUT.show(true)
    return
  }
  const paused = syncItem?.text.includes('已暫停') === true
  // 🔴 **來源清單不寫在這裡**——主行程不認識任何一個具體的面板。
  //    它只送 `use`，而 webview 那側用 `viewsWith('editable')` 決定有哪些。
  const picked = await vscode.window.showQuickPick(
    [
      paused ? '▶ 恢復自動同步' : '⏸ 暫停自動同步',
      '⟳ 以文件為準（重建積木）',
      '⟳ 以這個面板為準（寫回文件）',
    ],
    { title: '同步' },
  )
  if (!picked) return
  if (picked.startsWith('⏸')) active.sendSync({ action: 'pause' })
  else if (picked.startsWith('▶')) active.sendSync({ action: 'resume' })
  else if (picked.includes('文件為準')) active.sendSync({ action: 'use', viewId: 'vscode-code-view' })
  else active.sendSync({ action: 'use', viewId: 'blockly-panel' })
}

/** 讓指令問得到目前的面板。⚠️ 沒有面板時什麼都不做——**而要說得出來**。 */
export function requestDiagnostics(): void {
  if (!active) {
    OUTPUT.appendLine('Semorphe 診斷：面板還沒打開')
    OUTPUT.show(true)
    return
  }
  active.askDiagnostics()
}

/**
 * 開一個面板——**一種投影一個**（2026-09-01）。
 *
 * 🔴 已經開著就 `reveal`，不重開：兩個「積木」面板不是兩個選擇，是一份雜訊
 * （而它們會各自載一份 Blockly）。
 *
 * ⚠️ **版面完全交給 VSCode**：拖到側邊、拆成兩欄、用它自己的分隔線
 * ——我們一句話都不說。所以這裡只挑一個**起始**欄位，之後使用者放哪就是哪。
 *
 * > **把一件事交給宿主，就要連【談論它的介面】一起交出去。**
 */
export function openPanel(context: vscode.ExtensionContext, kind: VscodeViewKind = 'blocks'): void {
  extensionContext = context
  // 🔴 **主控台不在編輯器區**（2026-09-02，spec 171）：它是宿主 panel 區的一個
  //    視圖，與終端機／問題並排。叫它出來的方式是宿主自己的 `.focus` 指令
  //    ——⚠️ 我們不能（也不該）自己 `createWebviewPanel` 一個出來。
  if (kind === 'state') {
    void vscode.commands.executeCommand(`${CONSOLE_VIEW_ID}.focus`)
    return
  }
  const existing = sessions.get(kind)
  if (existing) { existing.reveal(startColumn(kind)); return }

  const panel = vscode.window.createWebviewPanel(VIEW_TYPES[kind], TITLES[kind], startColumn(kind), {
    enableScripts: true,
    // ⚠️ 收起來再打開**不要重建**——重建等於重新載入 200 顆膠囊 ＋ 重新 inject。
    retainContextWhenHidden: true,
    localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, ...DIST)],
  })
  const session = new SemorpheSession(panel, context.extensionUri, context.workspaceState, kind)
  sessions.set(kind, session)
  active = session
  // 🔴 **「目前是哪一個」由【看】決定，不由【開】決定**——狀態列上那顆
  //    「骨架」按下去，使用者心裡想的是他正在看的那個面板。
  panel.onDidChangeViewState(() => {
    if (!panel.active) return
    active = session
    // ⚠️ 切過去就要重畫——否則狀態列還在說上一個面板的事。
    renderActiveControls()
  }, null, context.subscriptions)
  panel.onDidDispose(() => session.dispose(), null, context.subscriptions)
}

/**
 * **panel 區那個視圖的 id**——`manifest.ts` 宣告它，這裡實作它。
 *
 * ⚠️ 兩邊必須逐字相同，而 `tools/vscode-preflight` 會對這件事出聲。
 */
export const CONSOLE_VIEW_ID = 'semorphe.consoleView'

/**
 * **主控台住進宿主的 panel 區**（2026-09-02，spec 171）。
 *
 * 使用者逐字：「把我們的主控台跟原生的綁在一起，就是**多塞幾個 tab**，
 * 而不是走編輯視窗」——於是它與終端機／問題／輸出並排，開得掉、關得回來，
 * 而**上面那三欄**是編輯區。
 *
 * 🟢 已查證 Theia 支援這條路（bundle 裡有 `registerWebviewViewProvider`／
 * `resolveWebviewView`／`views.container.panel`／`contributes.view.webview`）
 * ——而它**沒有** `vscode.setEditorLayout`，那正是十字排不出來的原因。
 *
 * ⚠️ 這裡放的是**我們自己的 webview**，不是 Output channel：它有輸入框，
 * 所以 `cin` 有家（見 `vscode-profile.ts` 那段墓誌銘）。
 */
export function registerConsoleView(context: vscode.ExtensionContext): void {
  extensionContext = context
  context.subscriptions.push(vscode.window.registerWebviewViewProvider(
    CONSOLE_VIEW_ID,
    {
      resolveWebviewView(view: vscode.WebviewView): void {
        view.webview.options = {
          enableScripts: true,
          localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, ...DIST)],
        }
        // 🔴 `WebviewView` 沒有 `reveal`，它的說法是 `show(preserveFocus)`
        //    ——⚠️ 帶 `true`：有輸出時它自己回來**不該偷走鍵盤焦點**。
        const surface: SessionSurface = {
          webview: view.webview,
          reveal: () => view.show(true),
        }
        const session = new SemorpheSession(surface, context.extensionUri, context.workspaceState, 'state')
        sessions.set('state', session)
        view.onDidDispose(() => {
          session.dispose()
          if (sessions.get('state') === session) sessions.delete('state')
          if (active === session) active = undefined
        }, null, context.subscriptions)
      },
    },
    // ⚠️ 收起來再打開**不要重建**——重建等於重新載入膠囊 ＋ 重新 inject。
    { webviewOptions: { retainContextWhenHidden: true } },
  ))
}

/**
 * 起始欄位。⚠️ 只是**起始**——之後使用者拖到哪就是哪，我們不再過問。
 *
 * 積木開在編輯器旁邊；流程開在**已經有的那些之後**，讓兩個面板不互相蓋掉。
 */
function startColumn(kind: VscodeViewKind): vscode.ViewColumn {
  if (kind !== 'blocks' && sessions.size > 0) return vscode.ViewColumn.Beside
  return vscode.window.activeTextEditor ? vscode.ViewColumn.Beside : vscode.ViewColumn.One
}

/** 🪦 舊名。⚠️ `extension.ts` 與指令表還在用它——保留成一行轉呼叫。 */
export function openBlocksPanel(context: vscode.ExtensionContext): void {
  openPanel(context, 'blocks')
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

/** 同上，給 per-document 的偏好用（`DocPrefStore` 一樣不認識 `vscode`）。 */
function prefStore(memento: vscode.Memento): PrefStore {
  return {
    get: (k) => memento.get<DocPrefs>(k),
    set: (k, v) => void memento.update(k, v),
    keys: () => memento.keys(),
  }
}

/** ⚠️ 匯出給測試用——套用語義必須與 `applySpan` 一致，否則測試綠而檔案壞。 */
export { applySpan }
