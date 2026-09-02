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
import { isDocumentWriter, type VscodeViewKind } from './vscode-profile'
import { shouldRevealForConsoleMessage, bottomPageOf, type BottomPage } from '../core/host/console-surface'
import { hostName, hostCanCloseEditors, hostSeesPanelVisibility } from './host-quirks'
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
  // ⚠️ 這兩種**不走編輯器分頁**（它們是 panel 區的視圖）——留著是因為
  //    `viewType` 也當成 `data-view` 與登錄表的鍵在用。
  console: 'semorphe.consoleView',
  variables: 'semorphe.variablesView',
}
const TITLES: Record<VscodeViewKind, string> = {
  blocks: 'Semorphe 積木',
  flow: 'Semorphe 流程',
  // 🔴 **兩個原生分頁，各自一個名字**（2026-09-02，使用者逐字：
  //    「移到上面的 tab 變成『Semorphe 主控台』、『Semorphe 變數』」）。
  console: 'Semorphe 主控台',
  variables: 'Semorphe 變數',
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
 * **正在跑程式的那一個**——使用者在主控台打的那一行要送回給它。
 *
 * ⚠️ 它不是 `active`（「最後看的那一個」）：按下 Enter 的那一刻，
 * 使用者正在看的是**主控台**，而正在等那一行的是積木那個 webview。
 *
 * > **「誰在等這個答案」與「誰在畫面上」是兩個問題。**
 */
let runner: SemorpheSession | undefined

/**
 * **宿主的時間軸——一條，不是每個視窗一條**（2026-09-02）。
 *
 * 🔴 它本來是 per-session 的，而那答不出這個問題：
 * **使用者打的字被誰蓋掉了？** 一份多寫入者的病歷裡，每個寫入者手上的紀錄
 * 都只說「文件變了（外來）」——而「外來」正是要查的那個東西。
 *
 * > **一條每個嫌疑人各自保管的時間軸，說得出每個人做了什麼，
 * > 說不出他們的先後。**
 *
 * ⚠️ 所以每一則都標上**是哪一種視窗**。
 */
const HOST_LOG: string[] = []
let hostLogSeq = 0
let hostLogAt = 0

function hostNoteGlobal(kind: VscodeViewKind, line: string): void {
  const now = Date.now()
  const gap = hostLogAt === 0 ? 0 : now - hostLogAt
  hostLogAt = now
  hostLogSeq += 1
  HOST_LOG.push(
    `${String(hostLogSeq).padStart(3, ' ')}｜+${String(gap).padStart(5, ' ')}ms｜${kind.padEnd(9)}｜${line}`)
  while (HOST_LOG.length > 80) HOST_LOG.shift()
}

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
  /** 我現在在哪一欄。⚠️ panel 區的視圖沒有欄——它回 `undefined`。 */
  column?(): vscode.ViewColumn | undefined
  /** 換分頁上的標題——⚠️ 它換的是**顯示的名字**，不是 `viewType`（那個改不了）。 */
  setTitle?(title: string): void
  /** 現在看得見嗎。⚠️ panel 區的視圖有 `visible`，編輯器區的分頁也有。 */
  isVisible?(): boolean
  // 🪦 `close?()` 退場（2026-09-02）：切換視圖時**一個面板都不關**
  //    ——見 `showLayer` 的檔頭（使用者：「現在切到流程積木就不見了」）。
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

  /**
   * 🔴 **這個視圖畫的是【資料流】，不是投影**——所以它不是寫入者。
   *
   * 判準住在 `vscode-profile.ts` 的 `isDocumentWriter`（那裡有完整的病歷：
   * 使用者 2026-09-02「為何這 hello 一直閃？」）。⚠️ 這裡**不重寫那個判斷**
   * ——兩份會漂。
   */
  private get streamOnly(): boolean {
    return !isDocumentWriter(this.kind)
  }

  constructor(panel: SessionSurface, extensionUri: vscode.Uri, memento: vscode.Memento,
    kind: VscodeViewKind = 'blocks') {
    this.panel = panel
    this.kind = kind
    this.currentLayer = kind === 'flow' ? 'relation' : 'space'
    this.extensionUri = extensionUri
    this.viewStates = new ViewStateStore(mementoStore(memento))
    this.docPrefs = new DocPrefStore(prefStore(memento))
    this.panel.webview.html = this.html()

    this.panel.webview.onDidReceiveMessage(
      (m: WebviewMessage) => void this.onWebviewMessage(m), null, this.disposables)

    // 🔴 **資料流視圖不跟文件**（見 `streamOnly`）——它不 lift、不回寫，
    //    於是它不可能與別的視窗搶那份文件。
    //
    // ⚠️ 而**設定仍然要送**：語系與風格決定那兩個分頁上的字。
    if (this.streamOnly) {
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('semorphe')) this.sendConfig()
      }, null, this.disposables)
      this.sendConfig()
      return
    }

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
  private hostNote(line: string): void {
    hostNoteGlobal(this.kind, line)
  }

  /** 宿主時間軸——診斷用。⚠️ 它是**全域**的（見 `HOST_LOG`）。 */
  get hostTimeline(): readonly string[] {
    return HOST_LOG
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
    // 🔴 **執行的輸出要跨過這條線**（2026-09-02，spec 171 第二刀）。
    //
    // 主控台與變數變成 panel 區的兩個**原生分頁**之後，「跑程式的那個視窗」
    // 與「畫輸出的那個視窗」不再是同一個：▷ 在標題列上，它跑的是積木那個
    // webview，而主控台是另一個 webview。**主行程是它們之間唯一的通道。**
    //
    // ⚠️ 而這不是「被餵的薄視圖」那個反模式（`registerVariablesView` 的墓碑）：
    //    那條規矩管的是**投影**——一個必須被餵才畫得出來的投影，它不是在投影。
    //    而執行的輸出是**一條資料流**，三維錨定說它屬於情境（`history/198`）。
    //
    // > **投影要自己算；資料流本來就只有一個源頭。**
    if (m.type === 'console') {
      // 🔴 **記住誰在跑**——等一下使用者在主控台打的那一行要送回去給它。
      //    ⚠️ 任何一則都算（清空也是「這個視窗要開跑了」），不只是等輸入那一則。
      runner = this
      sessions.get('console')?.sendConsoleOut(m)
      return
    }
    if (m.type === 'showLayer') { await this.showLayer(m.layer); return }
    if (m.type === 'pickLayer') { await this.pickLayer(m.title, m.items); return }
    if (m.type === 'viewVisible') {
      if (this.reportedVisible !== m.visible) {
        this.reportedVisible = m.visible
        broadcastBottomVisibility()
      }
      return
    }
    if (m.type === 'toggleConsole') { await toggleHostConsole(m.page); return }
    if (m.type === 'execStatus') {
      runner = this
      sessions.get('console')?.sendExecStatus(m.status, m.reason)
      return
    }
    if (m.type === 'variables') {
      sessions.get('variables')?.sendVariablesOut(m.groups)
      return
    }
    if (m.type === 'consoleSubmit') {
      // ⚠️ 送回**正在跑的那一個**，不是 `active`——`active` 是「最後看的」，
      //    而使用者按下 Enter 的那一刻他正在看主控台。
      runner?.sendConsoleInput(m.line)
      return
    }
    if (m.type === 'ready') {
      this.resend()
      // ⚠️ 面板剛起來，它還不知道這個宿主做得到什麼。
      this.sendHostCaps(canSwapEditor)
      return
    }
    if (m.type === 'requestDocument') {
      // 積木那側說它的鏡像對不上 → 宿主是權威，重送。
      if (this.doc) this.sendDocument(this.doc)
      return
    }
    if (m.type === 'setLanguageCpp') { await this.setLanguageCpp(); return }
    if (m.type === 'applyEdit') {
      // ⚠️ **資料流視圖不是寫入者**（見 `streamOnly`）——它送來的編輯一律不套。
      //    🔴 這一條是防守，不是機制：正常路徑上它根本沒有文件可以算出編輯。
      if (this.streamOnly) return
      await this.applyEdit(m.span, m.baseVersion); return
    }
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
      // 🔴 **宿主能力也印在這裡**（2026-09-02）。
      //
      //    我本來把它零散地 `appendLine` 到輸出頻道，而**診斷這一支開頭會
      //    `OUTPUT.clear()`**——於是使用者跑一次診斷，那幾行就被洗掉了。
      //
      // > **一個只在別的時間點印過一次的訊息，等於沒有印
      // > ——診斷要印的是【現在問得到的答案】，不是【曾經印過的字】。**
      OUTPUT.appendLine('')
      OUTPUT.appendLine('  宿主能力：')
      for (const line of hostCapsReport) OUTPUT.appendLine(`    ${line}`)
      OUTPUT.appendLine('')
      OUTPUT.appendLine(`  宿主時間軸（序號｜距上一則｜視窗｜事件）｜目前開著：${[...sessions.keys()].join('、')}`)
      if (HOST_LOG.length === 0) OUTPUT.appendLine('    （空——文件從頭到尾沒有變過）')
      for (const line of HOST_LOG) OUTPUT.appendLine(`    ${line}`)
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
    // ⚠️ **把寫進去的第一行也記下來**——「誰寫的」答不出「它把什麼變成什麼」，
    //    而使用者回報的病歷是「我打的字不見了」。
    this.hostNote(
      `✍️ 套用寫入｜${span.startLine}–${span.endLine} → ${span.lines.length} 行`
      + `｜版本 ${baseVersion}｜首行「${(span.lines[0] ?? '（空）').trim().slice(0, 40)}」`)

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

  /** 終端機打的一行 → webview。⚠️ 2026-09-02 起它也是「主控台那個視圖打的一行」。 */
  sendConsoleInput(line: string): void {
    this.send({ type: 'consoleInput', line })
  }

  /** 這一輪執行已經把主控台叫回來過了嗎——見 `shouldRevealForConsoleMessage`。 */
  private revealedThisRun = false

  /** 別的視窗在跑，而這個視窗（主控台）要把它畫出來。 */
  sendConsoleOut(m: { chunk?: string; clear?: boolean; awaitingInput?: string }): void {
    this.send({ type: 'consoleOut', chunk: m.chunk, clear: m.clear, awaitingInput: m.awaitingInput })
    // 🔴 **有輸出就自己回來，而「有輸出」的主詞是輸出**
    //    （使用者 2026-09-02：「好像被卡在主控台，而且我點其他的 tab 是
    //     切不過去的」——我本來在每一則上都叫了一次，`clear` 也算）。
    if (m.clear) { this.revealedThisRun = false; return }
    if (!shouldRevealForConsoleMessage(m, this.revealedThisRun)) return
    this.revealedThisRun = true
    this.panel.reveal()
  }

  /**
   * **這個分頁現在畫哪一層**——⚠️ 它是**可變的**（2026-09-02）。
   *
   * 🔴 `kind` 是這個分頁的**身分**（`viewType` 一旦建立就不能改，標題列的
   * `when` 也綁著它）；而它**畫哪一層**是可以換的——使用者要的是
   * 「欄位數不變，裡面的內容置換」。
   *
   * > **一個視窗的身分與它現在顯示什麼，不是同一件事
   * > ——而把它們寫成同一個欄位，就換不動了。**
   */
  private currentLayer: UnderstandingLayer

  get layer(): UnderstandingLayer {
    return this.currentLayer
  }

  /** 換掉這個分頁畫的那一層——⚠️ 分頁不搬家、不重建。 */
  setLayer(l: UnderstandingLayer): void {
    if (l === this.currentLayer) return
    this.currentLayer = l
    this.send({ type: 'setLayer', layer: l })
    this.panel.setTitle?.(l === 'relation' ? TITLES.flow : TITLES.blocks)
  }

  /**
   * 這個分頁現在看得見嗎——**兩個證人都說是，才算是**（2026-09-02）。
   *
   * ```
   * 宿主說的  `WebviewView.visible`
   *   ✅ VSCode 準
   *   ❌ Arduino IDE：不是被選到的分頁，它仍然回 true
   *      （使用者：「這邊應該是【顯示變數面板】吧」）
   *
   * webview 自己說的  `document.hidden`
   *   ❌ VSCode：`retainContextWhenHidden` 讓收起來的 webview 仍然是 hidden=false
   *      （使用者：「怎麼會兩個都隱藏？」）
   * ```
   *
   * 🔴 兩個各自都會說謊，而**它們說謊的方向一樣**：都是把「看不見」講成
   * 「看得見」。於是取 **AND**——兩個都說看得見才算。
   *
   * > **兩個都不可靠的訊號，如果它們錯的方向一致，交集就是可靠的。**
   *
   * ⚠️ 而萬一兩個都誤判成「看不見」：標籤會寫「顯示」而它其實開著，
   * 按下去只是聚焦——**弄錯的方向要選代價小的那一邊**。
   */
  private reportedVisible: boolean | undefined
  get isVisible(): boolean {
    return (this.panel.isVisible?.() ?? true) && (this.reportedVisible ?? true)
  }

  /** 我這個分頁在哪一欄。 */
  get columnOf(): vscode.ViewColumn | undefined {
    return this.panel.column?.()
  }

  /**
   * **把某一層換到我這一欄來**（2026-09-02）。
   *
   * 使用者在 IDE 裡點了槽上的下拉：「我希望點擊是可以**切換全部面板的選項**」。
   *
   * ## 🪦 這一支的做法換過兩次，而兩次都是使用者當場否決的
   *
   * ```
   * ① 疊上來（開新的，舊的留在同一欄當另一個分頁）
   *    使用者：「我覺得疊上來有點怪」
   *    ——那顆下拉寫的是「這一格顯示」，而疊上來之後這一欄有兩個分頁，
   *      「這一格顯示什麼」就有了兩個答案。
   *
   * ② 開新的、關掉舊的
   *    使用者：「我比較想直接把內部 WebView 切換掉的感覺，
   *              就是他原本已經存在，只是被喚醒然後移過來」
   *    ——關掉等於**丟掉一個已經開好的視窗**，再開要重新載入膠囊與注入畫布。
   * ```
   *
   * ```
   * ③ 兩兩對調（把它 reveal 到我這一欄、我搬去它那一欄）
   *    使用者：「三欄的比積木切到流程會只剩兩欄，剩程式和流程」
   *    ——移走之後那一欄空了，宿主把空的群組收掉，欄的編號整個往前挪，
   *      第二步就搬進了一個已經不是那個位子的欄。見 `placeColumns`。
   * ```
   *
   * 🟢 **④ 在一張順序表上對調，然後【由左到右整排重擺】**（現在這一版）。
   * 面板本來就開著，`reveal(column)` 做的是「移過去」——不重建、不丟狀態。
   *
   * 🔴 而這與**網頁版逐字相同**：那裡的槽下拉做的就是一次置換
   * （`swapTo`——「選到別處的就對調」）。兩個宿主第一次是同一個語義。
   *
   * > **「這一格顯示 X」的自然結果不是「把原本那個關掉」，
   * > 是「原本那個去 X 剛剛待的地方」——那才是一次對調。**
   *
   * ## ⚠️ 而「還沒開過的那一層」沒有位子可以換
   *
   * 🪦 曾經的退路是「開新的、**關掉自己**」——而使用者當場看到的是
   * 「現在切到流程**積木就不見了**」。
   *
   * 🔴 **一個面板都不關**：沒有對象可以換的時候，那一層接管我這一格，
   * 而我留在**同一欄的後面**（宿主的分頁）。它還活著，切回來是一次
   * `reveal`（幾毫秒），不是重新載入。
   *
   * > **「疊上來」是一個不好的【切換】，但它是一個好的【保留】
   * > ——而在沒有對象可以對調的那一格，選項只有保留或丟掉。**
   */
  /**
   * **用宿主自己的選單問「這一格顯示什麼」**（2026-09-02）。
   *
   * 使用者：「為何選單不是像網頁那樣是全域的？」
   *
   * 🔴 因為一個 webview 只畫得到**自己那個矩形**——網頁版那個選單蓋住整個
   * 視窗，是因為那裡整個視窗都是它的。在 IDE 裡 `position: fixed` 的盡頭
   * 是這塊面板的邊界。
   *
   * 🟢 而宿主的選單**是全域的**，這條路這個專案早就在走：目標／課程／風格
   * 那幾顆控制項都投影到 `vscode.window.showQuickPick`（`controlSurfaces`）。
   *
   * > **一個畫不出去的邊界，不是用更大的 z-index 解決的
   * > ——是把那件事交給畫得出去的那個人。**
   *
   * ⚠️ 選項由 webview 那側給：標籤要 i18n，而那份字典在那裡。
   */
  private async pickLayer(
    title: string,
    items: readonly { value: string; label: string; description?: string }[],
  ): Promise<void> {
    type Item = vscode.QuickPickItem & { value: string }
    const picked = await vscode.window.showQuickPick<Item>(
      items.map((i) => ({ label: i.label, description: i.description, value: i.value })),
      { title, placeHolder: title },
    )
    if (picked) await this.showLayer(picked.value)
  }

  private async showLayer(layer: string): Promise<void> {
    const mine: UnderstandingLayer | undefined =
      this.kind === 'blocks' ? 'space' : this.kind === 'flow' ? 'relation' : undefined
    if (!mine) return
    await swapLayer(this, layer as UnderstandingLayer)
  }

  /** 這個宿主做得到什麼——版面／槽的選單要據此決定列不列某些項。 */
  sendHostCaps(canSwap: boolean): void {
    this.send({ type: 'hostCaps', canSwapEditor: canSwap, canObserveBottomVisibility })
  }

  /** panel 區那兩頁看得見沒有——版面選單的標籤要用。 */
  sendBottomVisibility(v: { console: boolean; variables: boolean }): void {
    this.send({ type: 'bottomVisibility', ...v })
  }

  /** 執行狀態 → 畫主控台的那個視圖（它的狀態列要跟著走）。 */
  sendExecStatus(status: string, reason?: string): void {
    this.send({ type: 'execStatusOut', status, reason })
  }

  /** 同上，變數那一頁。 */
  sendVariablesOut(groups: { name: string; collapsed: boolean; variables: { name: string; type: string; value: string }[] }[]): void {
    this.send({ type: 'variablesOut', groups })
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
  if (id === 'layout') {
    // 🔴 **版面選單裡有一項不是版面**（2026-09-02）：「顯示／隱藏下方面板」。
    //
    //    ⚠️ 使用者回報「那選項沒有作用」，而根因就在這一行：這顆控制項
    //    **在宿主就地執行**（不轉回 webview），於是 webview 那側寫好的處置
    //    根本沒有機會跑；而 `applyEditorLayout` 對一個不是版面的值
    //    **安靜地回頭**。
    //
    // > **一個「就地執行」的分支，等於在宿主這側複製了一份值域
    // > ——而複製出來的那一份，不會自動跟著新增的選項長大。**
    const page = bottomPageOf(choice.value)
    if (page) { await toggleHostConsole(page); return }
    await applyEditorLayout(choice.value); return
  }
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
  if (!preset) {
    // 🔴 **不認得的值要出聲**——安靜地回頭正是「那選項沒有作用」那個病的形狀。
    OUTPUT.appendLine(`Semorphe 版面：不認得「${presetId}」——沒有這張版面`)
    return
  }
  // ⚠️ 「專注」的 `*` 跟著**目前這個面板**走——它就是使用者正在看的那一層。
  const focus: UnderstandingLayer = active?.kind === 'flow' ? 'relation' : 'space'
  await placeColumns(preset.areas[0].map((v) => (v === '*' ? focus : v)))

  // 🔴 **告訴面板它現在是哪一張**——不然狀態列上那顆會停在上一個名字。
  broadcastControl('layout', presetId)
}

/** 每一層在 IDE 裡由誰擔任。⚠️ `element` 是宿主自己的編輯器，不是我們的面板。 */
const KIND_OF: Partial<Record<UnderstandingLayer, VscodeViewKind>> = {
  relation: 'flow', space: 'blocks',
}

// 🪦 `columnOrder`（「目前每一欄是誰」）退場：槽的下拉**不再搬分頁**，
//    它換的是那個 webview 畫哪一層（見 `swapLayer`）。而版面那條路仍然
//    由左到右整排擺——見 `placeColumns`。

/**
 * **把這幾層依序擺成一欄一個**（2026-09-02）。
 *
 * ## 🔴 為什麼一定要【由左到右整排重擺】
 *
 * 使用者：「三欄的比積木切到流程會**只剩兩欄**，剩程式和流程」。
 *
 * 第一版是「兩兩對調」：把流程 `reveal` 到我這一欄、我搬去它那一欄。而
 * **把一個面板移走之後，它原本那一欄就空了——宿主會把空的分頁群組收掉**，
 * 於是欄的編號整個往前挪一格，第二步就搬進了一個**已經不是那個位子**的欄。
 *
 * > **在一個會自己收掉空欄的宿主上，「兩兩對調」不是一個原子操作
 * > ——第一步做完的那一瞬間，第二步的座標就已經失效了。**
 *
 * 🟢 由左到右整排重擺就沒有這個問題：每一步要嘛併進一個**已經在對的位子**的
 * 群組，要嘛在最右邊長出一個新的——而收掉的空欄永遠在還沒處理到的右側。
 *
 * ⚠️ `preserveFocus: true`——重擺不該把游標搶走。
 */
async function placeColumns(cols: readonly UnderstandingLayer[]): Promise<void> {
  if (!extensionContext || cols.length === 0) return

  // 🔴 **套一張版面要同時把【位置】與【內容】擺回去**（2026-09-02）。
  //
  //    使用者：「三欄不見了，在 ArduinoIDE 上」——狀態列寫著三欄，而畫面上
  //    只有兩欄。根因是槽的下拉會**換掉一個 webview 畫哪一層**（`swapLayer`），
  //    於是「流程」可能**沒有任何分頁在畫它**：一張只擺位置的版面救不回來。
  //
  // > **在一個「分頁可以改畫別的東西」的世界裡，「套版面」不只是把分頁排好
  // > ——它還要說清楚每一格【現在畫什麼】。**
  //
  // ⚠️ 順序：先找**已經在畫那一層的**（不動它最省），再找**本來就是那一種的**
  //    （被換走了就換回來），都沒有才開一個新的。
  const assigned = new Map<UnderstandingLayer, SemorpheSession>()
  for (const layer of cols) {
    const kind = KIND_OF[layer]
    if (!kind) continue
    const showing = [...sessions.values()].find((x) => x.layer === layer && !isAssigned(assigned, x))
    if (showing) { assigned.set(layer, showing); continue }
    const byKind = sessions.get(kind)
    if (byKind && !isAssigned(assigned, byKind)) {
      byKind.setLayer(layer)          // 它本來就是這一種，只是被換了內容 → 換回來
      assigned.set(layer, byKind)
      continue
    }
    openPanel(extensionContext, kind)
    const opened = sessions.get(kind)
    if (opened) { opened.setLayer(layer); assigned.set(layer, opened) }
  }

  const doc = active?.document ?? sessions.get('blocks')?.document
  for (const [j, layer] of cols.entries()) {
    if (layer === 'element') {
      if (doc) await vscode.window.showTextDocument(doc, { viewColumn: j + 1, preserveFocus: true })
      continue
    }
    await moveSessionTo(assigned.get(layer), j + 1)
  }
  await evenColumns()
}

/**
 * **把幾欄拉成等寬**（2026-09-02）。
 *
 * 使用者：「可以了！只不過**能不能三等分**？」「然後跳到對照的時候是**二等分**」。
 *
 * 🔴 為什麼不等寬：新的一欄是從**現有的某一欄切一半**長出來的
 * ——切兩次就是 `1/2 · 1/4 · 1/4`，而不是三等分。
 *
 * ⚠️ 而「把它們拉成等寬」是**宿主的動作**，我們碰不到它的分隔線：
 *
 * ```
 * VSCode  workbench.action.evenEditorWidths   ✅
 * Theia   （bundle 裡沒有這顆；`distributeViewSizes` 是內部方法，不是指令）
 * ```
 *
 * 🟢 所以這裡**問過再用**，而且把用了哪一顆寫進輸出頻道——下次有人問
 * 「為什麼 Arduino IDE 沒有等寬」，答案查得到。
 *
 * > **一個「請宿主做某件事」的呼叫，要先問它會不會
 * > ——而問不到的時候，要留下「我問過了」這件事。**
 */
async function evenColumns(): Promise<void> {
  const all = await vscode.commands.getCommands(true)
  for (const id of EVEN_WIDTH_COMMANDS) {
    if (all.includes(id)) { await vscode.commands.executeCommand(id); return }
  }
  // ⚠️ 這裡**不印**——那份清單的家是診斷報表（見 `diagnostics`）：
  //    診斷開頭會 `OUTPUT.clear()`，零散印的行會被洗掉。
}

/**
 * **這個宿主做得到哪幾件事**——診斷報表印它（見 `diagnostics` 那一段）。
 *
 * ⚠️ 它是**執行期問出來的**（`getCommands`），不是查 bundle 猜的。
 */
const hostCapsReport: string[] = ['（還沒探測）']

async function probeHostCaps(): Promise<void> {
  const all = await vscode.commands.getCommands(true)
  const even = EVEN_WIDTH_COMMANDS.find((c) => all.includes(c))
  const near = all.filter((c) => /even|distribute|ViewSize|EditorWidth|setEditorLayout/i.test(c))
  hostCapsReport.length = 0
  hostCapsReport.push(
    `名稱：${hostName()}`,
    `切換到程式碼：${canSwapEditor ? '可用' : '不列入（這個宿主關不掉檔案那個分頁）'}`,
    `平均欄寬：${even ?? '🔴 沒有（找過 ' + EVEN_WIDTH_COMMANDS.join('、') + '）'}`,
    `看得出面板開著沒有：${canObserveBottomVisibility ? '是' : '否（選單改用中性的名字）'}`,
    `相關的指令它有這些：${near.length ? near.join('、') : '（一個都沒有）'}`,
    `開關下方面板：${['workbench.action.togglePanel', 'core.toggle.bottom.panel'].find((c) => all.includes(c)) ?? '🔴 兩個都沒有'}`,
  )
}

/** ⚠️ 依序試——名字每個宿主不一樣，而**問過再用**（`getCommands`）。 */
const EVEN_WIDTH_COMMANDS = [
  'workbench.action.evenEditorWidths',
  'workbench.action.evenEditorGroups',
  'workbench.action.distributeEditorGroups',
  'core.distributeViewSizes',
  'view.distributeViewSizes',
]

/**
 * **把一個面板搬到第 n 欄——那一欄不存在的話，讓它長出來**（2026-09-02）。
 *
 * 🔴 `WebviewPanel.reveal(第三欄)` 在 VSCode 上會**長出第三欄**，而在
 * Arduino IDE 上**不會**——它把面板塞進現有的最後一欄。使用者：
 * 「這樣沒有分三欄啊」（流程與積木擠在同一欄的兩個分頁）。
 *
 * 🟢 而 `moveEditorToNextGroup` 在**兩個宿主上都會**長出新的一群
 * （這一刀稍早就是靠它做出「插一欄」的）。
 *
 * > **「把它放到第 n 欄」與「把它往右移一格」在欄位存在時是同一件事，
 * > 而在欄位不存在時，只有後者做得到。**
 */
async function moveSessionTo(sess: SemorpheSession | undefined, column: number): Promise<void> {
  if (!sess) return
  const groups = vscode.window.tabGroups?.all?.length ?? column
  if (column <= groups) { sess.reveal(column); return }
  // 那一欄還不存在 → 一步一步往右推，每一步都可能長出新的一群。
  for (let at = sess.columnOf ?? groups; at < column; at++) {
    sess.reveal()
    await vscode.commands.executeCommand('workbench.action.moveEditorToNextGroup')
  }
}

/** 這個 session 已經被這一輪指派過了嗎——⚠️ 一個分頁不能同時擔任兩層。 */
function isAssigned(
  assigned: ReadonlyMap<UnderstandingLayer, SemorpheSession>,
  sess: SemorpheSession,
): boolean {
  return [...assigned.values()].includes(sess)
}

/**
 * **這一格改顯示另一層——而【欄位一格都不動】**（2026-09-02）。
 *
 * ## 🪦 這一支的做法換過三次，每一次都是使用者當場否決的
 *
 * ```
 * ① 疊上來            「我覺得疊上來有點怪」
 *                      ——那一欄有兩個分頁，「這一格顯示什麼」就有兩個答案
 * ② 開新的、關掉舊的   「現在切到流程積木就不見了」
 *                      ——關掉等於丟掉一個已經開好的視窗
 * ③ 兩兩對調／整排重擺 「三欄的比積木切到流程會只剩兩欄」「現在更慘了」
 *                      ——移走面板那一欄就空了，宿主把空的群組收掉，欄數變少
 * ```
 *
 * 🟢 **④ 換內容**（現在這一版）。使用者逐字：「我希望的比較像是我的
 * **欄位數不變**，但是**裡面的內容置換**，就像網頁版那樣的處理」。
 *
 * 而那句話一講出來就清楚了：**我一直在搬分頁，而分頁不是格子——分頁就是內容。**
 * 在 IDE 裡一欄就是一個 webview，所以「格子不動而內容換」＝
 * **那個 webview 改畫另一層**（`setLayer`）。積木與流程兩個面板在每個 webview
 * 裡本來就都建好了，換的只是哪一格顯示——幾毫秒，什麼都不重建。
 *
 * > **在一個「格子就是容器」的地方，換位子與換內容是同一件事；
 * > 在一個「分頁就是內容」的地方，它們是兩件事——而使用者要的一直是後者。**
 *
 * ⚠️ 對方那一格也要跟著換（否則兩欄都畫同一層）——那正是網頁版的**置換**。
 * ⚠️ 而 `element`（程式碼）不是我們畫的，它是宿主自己的編輯器：那一格只能
 *    把編輯器叫到這一欄來，而我留在它後面（不關掉、不搬家）。
 */
/**
 * **開關宿主 panel 區的某一頁**（2026-09-02）。
 *
 * 使用者：「下方面板也分『主控台』『變數』，我要有『顯示…面板』的選項，
 * 如果現在已經是開著的，就是『隱藏…面板』。」
 *
 * 🔴 兩頁在這個宿主是 panel 區的**兩個容器**（各一個分頁）——而宿主的 API
 * 只給得出「把某個視圖叫出來」與「把整個 panel 區收起來」：
 *
 * ```
 * 看不見 → `<viewId>.focus`            把它叫出來（順便把 panel 區打開）
 * 看得見 → 收起整個 panel 區            ⚠️ 因為每一頁是自己的容器，
 *                                        它看得見就代表它是【現在那一個】
 * ```
 *
 * ⚠️ 那顆「收起來」的指令**每個宿主自己取名**（都查證過）：
 *
 * ```
 * VSCode  workbench.action.togglePanel   ✅
 * Theia   core.toggle.bottom.panel       ✅（Arduino IDE 的 bundle）
 * ```
 *
 * 🪦 我一度猜 `view.toggle`——它在 bundle 裡有這個字串，而它是**別的東西**
 * （側邊欄視圖的開關），於是使用者按下去「那選項沒有作用」。
 *
 * > **「這個字串在 bundle 裡」不等於「這顆指令做我以為的那件事」。**
 */
async function toggleHostConsole(page: BottomPage): Promise<void> {
  const shown = sessions.get(page)?.isVisible === true
  if (!shown) {
    await vscode.commands.executeCommand(`${PANEL_VIEW_IDS[page]}.focus`)
    return
  }
  const all = await vscode.commands.getCommands(true)
  for (const id of ['workbench.action.togglePanel', 'core.toggle.bottom.panel']) {
    if (all.includes(id)) { await vscode.commands.executeCommand(id); return }
  }
}

/** 這份文件的編輯器現在在哪一欄。⚠️ 不在畫面上時是 `undefined`。 */
function editorColumnOf(doc: vscode.TextDocument): vscode.ViewColumn | undefined {
  return vscode.window.visibleTextEditors
    .find((e) => e.document.uri.toString() === doc.uri.toString())?.viewColumn
}

/**
 * **與程式碼那一格【對調】**（2026-09-02）。
 *
 * 使用者：「我不是要輪轉，我是要**交換**」「現在我想把流程那邊切到程式碼，
 * 但是就**完全不會動**」。
 *
 * ## 🔴 我在這一支上錯了四次，而每一次都錯在同一個地方
 *
 * ```
 * ① 疊上來              使用者：「有點怪」
 * ② 開新的、關掉舊的      使用者：「積木就不見了」
 * ③ 兩兩對調／整排重擺    使用者：「三欄變兩欄」「更慘了」
 * ④ 沿路一格一格對調      使用者：「我不是要輪轉」
 * ⑤ 從邊緣拆出去          使用者：「完全不會動」
 * ```
 *
 * 共同的根：我一直想用「**把分頁往左／往右搬一格**」湊出「**在中間插一欄**」，
 * 而那個宿主沒有後者——⑤ 之所以不動，是因為「往外一步會長出一群」這件事
 * 我只在**右邊**驗過，左邊（`Previous`）在這個宿主上不長。
 *
 * > **我試了五種寫法去湊一個這個宿主沒有的動作，
 * > 而它一直都在旁邊：想插一欄，就先【多開一份】把那個位子佔住。**
 *
 * ## 🟢 而正確的做法只用三個【已經驗證過】的動作
 *
 * ```
 * ① showTextDocument(第 n 欄)  對編輯器是「再開一份」——⚠️ 而這裡正好要它
 * ② panel.reveal(第 n 欄)      webview 分頁真的會搬過去（實測過）
 * ③ 關掉多出來的那一份          tabGroups.close，沒有就退回 closeActiveEditor
 * ```
 *
 * 由左到右整排擺一次，那個「多開的一份」**在搬動途中把欄位撐著不塌**，
 * 擺完再把多的關掉：
 *
 * ```
 * 流程│程式碼│積木        （在流程這格選「程式碼」→ 想要 程式碼│流程│積木）
 *  ① 程式碼開一份在第 1 欄   流程＋程式碼′│程式碼│積木
 *  ② 流程搬到第 2 欄        程式碼′│程式碼＋流程│積木
 *  ③ 積木搬到第 3 欄        （原地）
 *  ④ 關掉第 2 欄那一份       程式碼│流程│積木        ✅ 真的對調
 * ```
 */
async function swapWithEditor(self: SemorpheSession): Promise<void> {
  const doc = self.document ?? active?.document
  const myCol = self.columnOf
  if (!doc || !myCol) return
  const eCol = editorColumnOf(doc)
  if (!eCol) {
    // 編輯器不在畫面上 → 沒有位子可以換：把它叫到我這一格（我留在它後面）。
    await vscode.window.showTextDocument(doc, { viewColumn: myCol, preserveFocus: false })
    return
  }
  if (eCol === myCol) return

  // 目前由左到右是誰：`element` ＝ 編輯器，其餘是面板。
  type Slot = { col: number; sess?: SemorpheSession }
  const slots: Slot[] = [
    { col: eCol },
    ...[...sessions.values()]
      .filter((x) => typeof x.columnOf === 'number' && x.columnOf !== eCol)
      .map((x) => ({ col: x.columnOf as number, sess: x })),
  ].sort((a, b) => a.col - b.col)

  // 對調：我與編輯器交換位子（其餘一格不動）。
  const i = slots.findIndex((x) => x.sess === self)
  const j = slots.findIndex((x) => !x.sess)
  if (i < 0 || j < 0) return
  const order = slots.map((x) => x.sess)
  ;[order[i], order[j]] = [order[j], order[i]]

  // ① 由左到右擺一次。⚠️ 編輯器那一格是「再開一份」——它同時把位子撐著。
  for (const [k, sess] of order.entries()) {
    if (sess) sess.reveal(k + 1)
    else await vscode.window.showTextDocument(doc, { viewColumn: k + 1, preserveFocus: true })
  }

  // ② 關掉多出來的那幾份——⚠️ 只關**這份文件**、且**不在目標欄**的那些。
  const target = order.findIndex((x) => !x) + 1
  await closeDuplicateEditors(doc, target)

  // 🔴 **量一次結果**：還留著重複的 ⟹ 這個宿主關不掉分頁，把那個選項收起來。
  //    （使用者在 Arduino IDE：「檔案沒有辦法關閉」）
  const leftovers = vscode.window.visibleTextEditors
    .filter((e) => e.document.uri.toString() === doc.uri.toString()).length
  if (leftovers > 1 && canSwapEditor) {
    canSwapEditor = false
    OUTPUT.appendLine('Semorphe：這個宿主關不掉重複的【檔案】分頁 → 「程式碼」不再列進切換選單')
    broadcastHostCaps()
  }
}

/**
 * 關掉這份文件在**目標欄以外**的分頁。
 *
 * ⚠️ `tabGroups` 不一定每個宿主都有（Theia 的 bundle 裡有這個字串，而
 * 「有字串」不等於「行為一樣」）——所以有退路：聚焦那一份，再叫宿主關掉
 * 作用中的那個分頁。
 *
 * 🔴 而它**只關這一份文件**：使用者自己開的其他檔一個都不准動。
 */
async function closeDuplicateEditors(doc: vscode.TextDocument, keepColumn: number): Promise<void> {
  const uri = doc.uri.toString()
  const groups = vscode.window.tabGroups
  if (groups?.close) {
    const dupes = groups.all.flatMap((g) => g.tabs.filter((t) => {
      const input = t.input as { uri?: vscode.Uri } | undefined
      return input?.uri?.toString() === uri && g.viewColumn !== keepColumn
    }))
    if (dupes.length > 0) { await groups.close(dupes, true); return }
  }
  // 退路：一份一份聚焦再關。
  for (let guard = 0; guard < 4; guard++) {
    const at = vscode.window.visibleTextEditors
      .find((e) => e.document.uri.toString() === uri && e.viewColumn !== keepColumn)?.viewColumn
    if (!at) return
    await vscode.window.showTextDocument(doc, { viewColumn: at, preserveFocus: false })
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor')
  }
}

async function swapLayer(self: SemorpheSession, theirs: UnderstandingLayer): Promise<void> {
  const mine = self.layer
  if (mine === theirs) return

  if (theirs === 'element') { await swapWithEditor(self); return }
  if (theirs !== 'relation' && theirs !== 'space') return

  // 🔴 **置換**：現在畫著那一層的那個分頁，改畫我這一層。
  for (const other of sessions.values()) {
    if (other !== self && other.layer === theirs) other.setLayer(mine)
  }
  self.setLayer(theirs)
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
  if (extensionContext) openPanel(extensionContext, 'console')
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
export function openPanel(
  context: vscode.ExtensionContext,
  kind: VscodeViewKind = 'blocks',
  /** ⚠️ 指定要開在哪一欄——槽的下拉用它（「把那一層叫到**我這一欄**」）。 */
  column?: vscode.ViewColumn,
): void {
  extensionContext = context
  // 🔴 **主控台與變數不在編輯器區**（2026-09-02，spec 171）：它們是宿主 panel 區
  //    的兩個視圖，與終端機／問題並排。叫它們出來的方式是宿主自己的 `.focus`
  //    指令——⚠️ 我們不能（也不該）自己 `createWebviewPanel` 一個出來。
  if (kind === 'console' || kind === 'variables') {
    void vscode.commands.executeCommand(`${PANEL_VIEW_IDS[kind]}.focus`)
    return
  }
  const existing = sessions.get(kind)
  if (existing) { existing.reveal(column ?? startColumn(kind)); return }

  const panel = vscode.window.createWebviewPanel(VIEW_TYPES[kind], TITLES[kind], column ?? startColumn(kind), {
    enableScripts: true,
    // ⚠️ 收起來再打開**不要重建**——重建等於重新載入 200 顆膠囊 ＋ 重新 inject。
    retainContextWhenHidden: true,
    localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, ...DIST)],
  })
  const surface: SessionSurface = {
    webview: panel.webview,
    reveal: (col) => panel.reveal(col),
    column: () => panel.viewColumn,
    setTitle: (t) => { panel.title = t },
  }
  const session = new SemorpheSession(surface, context.extensionUri, context.workspaceState, kind)
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
 * **panel 區那兩個視圖的 id**——`manifest.ts` 宣告它們，這裡實作它們。
 *
 * ⚠️ 兩邊必須逐字相同，而 `tools/vscode-preflight` 會對這件事出聲。
 */
export const PANEL_VIEW_IDS = {
  console: 'semorphe.consoleView',
  variables: 'semorphe.variablesView',
} as const

/**
 * **主控台與變數住進宿主的 panel 區**（2026-09-02，spec 171）。
 *
 * 使用者逐字：「把我們的主控台跟原生的綁在一起，就是**多塞幾個 tab**，
 * 而不是走編輯視窗」，看到成品之後再一句：「我是希望主控台和變數可以**移到
 * 上面的 tab** 變成『Semorphe 主控台』、『Semorphe 變數』」。
 *
 * 🔴 於是是**兩個容器各一個視圖**，不是一個容器裡兩個——在 panel 那一排上，
 * **一個容器就是一個分頁**，而使用者要的是那一排上的兩個名字。
 *
 * 🟢 已查證 Theia 支援這條路（bundle 裡有 `registerWebviewViewProvider`／
 * `resolveWebviewView`／`views.container.panel`／`contributes.view.webview`）
 * ——而它**沒有** `vscode.setEditorLayout`，那正是十字排不出來的原因。
 *
 * ⚠️ 這裡放的是**我們自己的 webview**，不是 Output channel：它有輸入框，
 * 所以 `cin` 有家（見 `vscode-profile.ts` 那段墓誌銘）。
 */
/**
 * **這個宿主換得動編輯器嗎**（2026-09-02）。
 *
 * 🔴 與程式碼那一格對調要「多開一份撐住位子、再把多的關掉」
 * （見 `swapWithEditor`），而有的宿主關不掉檔案那個分頁。
 *
 * ⚠️ 它有**兩層**：`host-quirks` 的名單（探測不出來的那幾筆，附病歷）
 * ＋ **實測降級**（做完之後量一次，還留著重複的就關掉這個能力）。
 *
 * > **一個「這個宿主做得到嗎」的旗標，最誠實的來源是【它剛才做到了沒有】。**
 */
let canSwapEditor = hostCanCloseEditors()
  && typeof vscode.window.tabGroups?.close === 'function'

/**
 * **這個宿主答得出「那兩頁現在開著沒有」嗎**——答不出來時選單改用中性的名字。
 *
 * 見 `host-quirks.ts`：兩個可見性訊號在 Arduino IDE 上同時說謊。
 */
const canObserveBottomVisibility = hostSeesPanelVisibility()

/** 能力變了 → 告訴每一個面板（那個選項要跟著出現或消失）。 */
function broadcastHostCaps(): void {
  for (const s of sessions.values()) s.sendHostCaps(canSwapEditor)
}

/** panel 區那兩頁的可見性 → 每一個面板（版面選單的標籤要用）。 */
function broadcastBottomVisibility(): void {
  const v = {
    console: sessions.get('console')?.isVisible === true,
    variables: sessions.get('variables')?.isVisible === true,
  }
  for (const s of sessions.values()) s.sendBottomVisibility(v)
}

export function registerConsoleView(context: vscode.ExtensionContext): void {
  extensionContext = context
  // ⚠️ **把判斷寫下來**：下次有人問「為什麼這裡沒有程式碼那個選項」，
  //    答案要查得到，而不是要重讀一次原始碼。
  void probeHostCaps()
  for (const kind of ['console', 'variables'] as const) {
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(
      PANEL_VIEW_IDS[kind],
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
            isVisible: () => view.visible,
          }
          const session = new SemorpheSession(surface, context.extensionUri, context.workspaceState, kind)
          sessions.set(kind, session)
          // 🔴 **看得見沒有要推給每一個面板**——版面選單上那兩個標籤靠它
          //    才說得出「顯示」還是「隱藏」。
          view.onDidChangeVisibility(() => broadcastBottomVisibility(), null, context.subscriptions)
          broadcastBottomVisibility()
          view.onDidDispose(() => {
            session.dispose()
            if (sessions.get(kind) === session) sessions.delete(kind)
            if (active === session) active = undefined
            broadcastBottomVisibility()
          }, null, context.subscriptions)
        },
      },
      // ⚠️ 收起來再打開**不要重建**——重建等於重新載入膠囊 ＋ 重新 inject。
      { webviewOptions: { retainContextWhenHidden: true } },
    ))
  }
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
