import * as monaco from 'monaco-editor'
import { preserveBlankLines } from '../../core/projection/preserve-blank-lines'
import type { ViewHost, ViewCapabilities, ViewConfig, SemanticUpdateEvent, ExecutionStateEvent, ExecutionAtNodeEvent, DiagnosticsEvent, EditableSource } from '../../core/view-host'
import type { CodeMapping } from '../../core/projection/code-generator'
import { mappingFor, codeDiagnosticMessage } from '../../core/projection/diagnostic-projection'
import { nodesAtBreakpoints } from '../../core/projection/code-mapping'
import { isResidualCause } from '../../core/diagnostics'
import type { SemanticBus } from '../../core/semantic-bus'
import type { SemanticNode } from '../../core/types'

import type { ScaffoldResult, ScaffoldItem } from '../../core/program-scaffold'
import type { CodeView } from '../../core/host/code-view'

export class MonacoPanel implements ViewHost, CodeView {
  /**
   * 🔴 **網頁版的編輯器面板【什麼都不缺】。**
   *
   * 這一格是空的**不是因為忘了填**——它是一份宣告：
   * 四個可選能力（重排／行動版／桌面版／取得底層編輯器）**全部都有**。
   *
   * ⚠️ 由 `tests/integration/host-code-view-contract.test.ts` 釘住：
   * 沒實作的可選方法與這裡的鍵**必須一模一樣**。
   */
  readonly absentReasons = {}

  readonly viewId = 'monaco-panel'
  readonly viewType = 'monaco'
  readonly capabilities: ViewCapabilities = {
    editable: true,
    needsLanguageProjection: true,
    consumedAnnotations: [],
    /** 程式碼＝**有哪些東西**——`concepts/理解的層次.md` */
    layer: 'element' as const,
  }

  private editor: monaco.editor.IStandaloneCodeEditor | null = null
  private container: HTMLElement
  private onChangeCallback: ((code: string) => void) | null = null
  private onCursorChangeCallback: ((line: number) => void) | null = null
  private suppressChange = false
  private highlightCollection: monaco.editor.IEditorDecorationsCollection | null = null
  private pendingHighlight: { startLine: number; endLine: number; variant: 'block-to-code' | 'code-to-block' } | null = null
  private bus: SemanticBus | null = null
  private codeMappings: CodeMapping[] = []
  private currentTree: SemanticNode | null = null
  private breakpoints: Set<number> = new Set()
  private breakpointCollection: monaco.editor.IEditorDecorationsCollection | null = null
  private onBreakpointChangeCallback: ((breakpoints: number[]) => void) | null = null

  // Ghost line state
  private ghostCollection: monaco.editor.IEditorDecorationsCollection | null = null
  private ghostLineMap: Map<number, ScaffoldItem> = new Map()
  private hoverProvider: monaco.IDisposable | null = null
  private onPinCallback: ((code: string) => void) | null = null

  constructor(container: HTMLElement) {
    this.container = container
  }

  async initialize(_config: ViewConfig): Promise<void> {
    // ViewHost lifecycle — actual init handled by init() method
  }

  onSemanticUpdate(event: SemanticUpdateEvent): void {
    // ⚠️ `resync` 不可漏——它原本由 `app.ts` 的第二條線補。
    // 兩條線的條件不一樣，而那種不一致只會在其中一條被刪掉時才現形。
    if ((event.source === 'blocks' || event.source === 'resync') && event.code !== undefined) {
      // 🔴 **空行要還回去**（2026-08-24，使用者拍板）。
      //
      // 這個問題掛了幾天，而它的形式是「網頁版的程式碼面板，是**使用者的東西**
      // 還是**投影的產物**？」——如果是前者，排版屬於他，要保留；
      // 如果是後者，它每次都可以重生。
      //
      // 使用者逐字：「**網頁版的程式碼面板也是投影的產物，與 VSCode 的面板
      // 應該行為一致**」——**兩個判斷合起來才是答案**：
      // 它是投影，而**投影的行為只有一套**。
      //
      // > **同一個東西在兩個宿主裡有兩種行為，那不是兩個實作，是一個沒被回答的問題。**
      //
      // ⚠️ 機制早就存在（`preserve-blank-lines.ts`，2026-08-19 為擴充那側做的），
      //    而網頁版**一直沒接**——見那個檔頭：「一個機制只接了一個宿主，
      //    那它的另一半是不存在的」。
      this.setCode(preserveBlankLines(this.getCode(), event.code))
      if (event.scaffoldResult) {
        this.applyScaffoldDecorations(event.code, event.scaffoldResult)
      }
    }
    // ⚠️ **`mappings` 這個欄位在事件上宣告了很久，而零接收者。**
    // `sync-controller` 兩處在發它（`blocks` 與 `resync`），沒有人接
    // ——「機制有了沒人接上」的又一筆。這個視圖需要它才能把
    // 「執行到哪個節點」翻譯成自己的座標（行號）。
    if (event.mappings) {
      this.codeMappings = event.mappings
      // ⚠️ 對映變了，同一批斷點會落在不同的節點上——要重推。
      this.publishBreakpoints()
    }
    if (event.tree) {
      this.currentTree = event.tree
      this.renderResidual(event.tree)
    }
  }

  /**
   * **殘差在程式碼側現形**——而它刻意不長得像錯誤。
   *
   * ## 為什麼殘差與診斷不能共用一個通道
   *
   * `audit-behavior-error` 的檔頭逐字：
   * 「**殘差高＝模型還沒長到那裡（系統仍然正確）**；**誤差高＝模型是錯的**」。
   *
   * ```
   * 殘差   我還不認得這一段     ← 我們的問題
   * 誤差   你寫錯了             ← 使用者的問題
   * ```
   *
   * > **把殘差併進診斷，學生會看到「你的程式有 12 個錯誤」，
   * > 而其中 11 個是我們的問題。**
   *
   * ⚠️ 所以它用 **`Info`** 而不是 `Error`／`Warning`，而且用**另一個 owner**
   * ——診斷變了不會清掉殘差，反過來也是。兩個數字要能分開看。
   */
  private renderResidual(tree: SemanticNode): void {
    const model = this.editor?.getModel()
    if (!model) return
    const markers: monaco.editor.IMarkerData[] = []
    const walk = (n: SemanticNode): void => {
      const cause = n.metadata?.degradationCause
      // 🔴 **`syntax_error` 已經搬去診斷通道了**（Error 級、owner `semorphe`）。
      // 不濾的話同一件事顯示兩次——一條紅波浪疊一條灰提示。
      // ⚠️ 而另外兩種**一行不動**：它們真的是「我們還沒長到」，
      // 刻意不長得像錯誤。判準的不變式由 `diagnostics-from-tree.test.ts` 釘住。
      if (isResidualCause(cause)) {
        const m = this.mappingFor(n.id)
        if (m) {
          const endLine = m.endLine + 1
          markers.push({
            severity: monaco.MarkerSeverity.Info,
            message: this.residualMessage(cause ?? '', String(n.metadata?.rawCode ?? '')),
            startLineNumber: m.startLine + 1,
            startColumn: 1,
            endLineNumber: endLine,
            endColumn: model.getLineMaxColumn(endLine),
          })
        }
      }
      for (const bucket of Object.values(n.children ?? {})) for (const c of bucket ?? []) walk(c)
    }
    walk(tree)
    monaco.editor.setModelMarkers(model, 'semorphe-residual', markers)
  }

  /**
   * 殘差的訊息——**主詞是「我」，不是「你」**。
   *
   * ⚠️ 那不是修辭：`syntax_error` 是使用者寫壞了，而 `unsupported` 是我們沒長到。
   * 兩者用同一個 severity（都不是錯誤），**而句子要說得出是誰的問題**。
   */
  private residualMessage(cause: string, raw: string): string {
    const snippet = raw.trim().replace(/\s+/g, ' ').slice(0, 40)
    const tail = snippet ? `：${snippet}` : ''
    if (cause === 'syntax_error') return `這一段的語法不完整，積木上會少一塊${tail}`
    if (cause === 'unsupported') return `這個寫法我還不認得，它會原樣保留${tail}`
    return `這個寫法不是標準語法，它會原樣保留${tail}`
  }

  /**
   * 把「哪幾行有斷點」翻譯成「哪些語義節點有斷點」，推上匯流排。
   *
   * ⚠️ **翻譯發生在這裡，而不是執行器裡**——「行」是這個視圖的語彙。
   * 判準與原本執行器裡那行等價：斷點行落在某個節點的 `[start, end]` 區間內。
   *
   * 兩個觸發點都要推，缺一個就會出現「設了斷點但不會停」：
   * ① 使用者切換斷點　② 對映更新（樹變了，同一行對到不同節點）
   */
  private publishBreakpoints(): void {
    if (!this.bus) return
    this.bus.emit('execution:breakpoints', { nodeIds: nodesAtBreakpoints(this.codeMappings, this.breakpoints) })
  }

  /** ⚠️ 這個視圖用匯流排**發**（斷點翻譯），不只收。 */
  connectBus(bus: SemanticBus): void {
    this.bus = bus
    this.publishBreakpoints()
  }

  /**
   * 執行走到某個節點時，**這個視圖的投影是「捲到那幾行並highlight」**。
   *
   * ⚠️ 兩件屬於這個視圖的知識跟著搬進來了，它們原本住在執行器與中央對映表：
   *
   * **① `revealLine` 必須在 `addHighlight` 之前**——`revealLine` 會觸發
   * `onCursorChange`，而那會清掉 highlight。那是 Monaco 的行為，
   * 執行器不該知道它。
   *
   * **② 表達式節點沒有自己的 `codeMapping`，要往上找最近的祖先**
   * （`while (scanf(...))` 裡的 `scanf` 節點）。
   * ⚠️ **積木那側沒有這個問題**，因為每個節點都有積木。
   *
   * > **一個只有某一種投影才會遇到的問題，它的解法就該住在那種投影裡。**
   */
  onExecutionAtNode(event: ExecutionAtNodeEvent): void {
    if (!event.nodeId) {
      this.clearHighlight()
      return
    }
    const m = this.mappingFor(event.nodeId)
    if (!m) return
    // ⚠️ 順序不可調換，見上方 ①。
    if (event.follow) this.revealLine(m.startLine + 1)
    this.addHighlight(m.startLine + 1, m.endLine + 1)
  }

  /**
   * 診斷的**程式碼側投影**：紅／黃波浪底線。
   *
   * ## 這是驗收②，而它是①的可否證版本
   *
   * 錨點還是 `blockId` 的話**這一條做不到**——Monaco 不認識 blockId。
   * 所以「波浪出得來」就是「錨點真的換成 nodeId 了」的證據。
   *
   * ⚠️ 用 `setModelMarkers` 而不是 decoration：marker 是 Monaco 給**診斷**用的
   * 通道（滑鼠移上去有訊息、可以被 problems 面板收），
   * decoration 是給高亮用的。**兩者不要混**——執行高亮已經用掉 decoration 了。
   */
  onDiagnostics(event: DiagnosticsEvent): void {
    const model = this.editor?.getModel()
    if (!model) return
    const markers: monaco.editor.IMarkerData[] = []
    for (const d of event.diagnostics) {
      // ⚠️ 對映不到就**跳過**，不要退回第 1 行——一個指錯地方的波浪
      // 比沒有波浪更糟：它會讓學生去看一段沒有問題的程式碼。
      const m = this.mappingFor(d.nodeId)
      if (!m) continue
      const startLine = m.startLine + 1
      const endLine = m.endLine + 1
      // 🔴 **缺口有確定的位置——波浪就該縮到那裡**（spec 143）。
      //
      // 沒有 `at` 的診斷照舊畫**整行**：那是誠實的，因為 `nodeId` 只指得到
      // 「哪一顆節點」，指不到「哪一欄」。
      //
      // ⚠️ 而縮的時候**寬度至少 1 欄**：一個缺掉的 token **佔零個字元**，
      // `start === end` 的 marker 在 Monaco 上**畫不出來**
      // ——那會讓「修好了」與「畫不出來」長得一樣。
      const at = d.at
      markers.push(at
        ? {
            severity: d.severity === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
            message: this.diagnosticMessage(d),
            startLineNumber: at.line + 1,
            startColumn: at.column + 1,
            endLineNumber: at.line + 1,
            endColumn: Math.max(at.column + 2, model.getLineMaxColumn(at.line + 1)),
          }
        : {
            severity: d.severity === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
            message: this.diagnosticMessage(d),
            startLineNumber: startLine,
            startColumn: 1,
            endLineNumber: endLine,
            endColumn: model.getLineMaxColumn(endLine),
          })
    }
    // **一次設完整集合**——`setModelMarkers` 的語義就是取代，
    // 所以「診斷變少了」會自動反映，不需要另外清。
    monaco.editor.setModelMarkers(model, 'semorphe', markers)
  }

  /**
   * **程式碼側自己把一則診斷組成訊息。**
   *
   * 這裡的收件人正在看原始碼，所以措辭偏編譯器——而積木側刻意不一樣
   * （使用者 2026-08-12 逐字：「越像實際編譯器吐出的訊息越好……
   * **不過積木側可以不一樣**」）。**那就是第二條軸，而它只有面板這一條。**
   *
   * ⚠️ 2026-08-14 之前這裡寫的是「兩條軸（**學生程度** × 面板）」，
   * 而「學生程度」已經被否決：一個學生走過的是概念的**集合**，
   * 樹上的等級描述不了他（`knowledge/experience.md`
   * 「一個座標可以描述節點，不代表它描述得了走到這裡的人」）。
   *
   * ## 🔴 而這個函式以前查的是一個不存在的東西
   *
   * 舊寫法是 `window.Blockly?.Msg?.[key] ?? key`——而 `Blockly.Msg` 是
   * **Blockly 模組上的物件**，`window.Blockly` 在打包後的 app 裡不存在。
   * 於是這裡**一直走 fallback**，把 `DIAG_MISSING_CONDITION` 這串代號
   * 當訊息顯示給使用者（2026-08-14 由 e2e 抓到）。
   *
   * 現在查的是**面板中立的 `i18n/messages`**，程式碼視圖因此
   * **不需要認識 Blockly**。
   */
  diagnosticMessage(d: DiagnosticsEvent['diagnostics'][number]): string {
    // 🔴 實作在核心——**兩個程式碼視圖必須說同一句話**。
    return codeDiagnosticMessage(d)
  }

  /**
   * nodeId → 行區間。表達式節點往上找最近有對映的祖先（見 `onExecutionAtNode` ②）。
   *
   * 🔴 **實作在核心**（`core/projection/diagnostic-projection.ts`）——
   * 擴充裡那個沒有畫布的程式碼視圖需要同一段（2026-08-25「診斷 → Problems」）。
   */
  private mappingFor(nodeId: string): CodeMapping | undefined {
    return mappingFor(this.codeMappings, this.currentTree ?? null, nodeId)
  }

  onExecutionState(_event: ExecutionStateEvent): void {
    // MonacoPanel doesn't handle execution state directly
  }

  // ⚠️ 沒有 `connectBus` 了——`semantic:update` 由視圖登錄表統一派送
  // （`core/view-registry.ts` 的 `connectViews`）。

  init(readOnly = true): void {
    this.editor = monaco.editor.create(this.container, {
      value: '',
      language: 'cpp',
      theme: 'vs-dark',
      readOnly,
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 14,
      lineNumbers: 'on',
      scrollBeyondLastLine: true,
      wordWrap: 'off',
      tabSize: 4,
      renderWhitespace: 'none',
      folding: true,
      glyphMargin: true,
      lineDecorationsWidth: 10,
      lineNumbersMinChars: 3,
    })

    this.editor.onDidChangeModelContent(() => {
      if (!this.suppressChange) {
        this.onChangeCallback?.(this.getCode())
      }
    })

    this.editor.onDidChangeCursorPosition((e) => {
      if (this.onCursorChangeCallback) {
        this.onCursorChangeCallback(e.position.lineNumber)
      }
    })

    this.editor.onMouseDown((e) => {
      if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
        const line = e.target.position?.lineNumber
        if (line) {
          // Check if this is a ghost line — clicking glyph margin pins it
          const ghostItem = this.ghostLineMap.get(line)
          if (ghostItem && ghostItem.visibility === 'ghost') {
            this.onPinCallback?.(ghostItem.code)
            return
          }
          this.toggleBreakpoint(line)
        }
      }
    })

    // Register hover provider for ghost line tooltips
    this.registerGhostHoverProvider()

    // Add clipboard action bar
    this.createClipboardBar()
  }

  onChange(callback: (code: string) => void): void {
    this.onChangeCallback = callback
  }

  onCursorChange(callback: (line: number) => void): void {
    this.onCursorChangeCallback = callback
  }

  onPin(callback: (code: string) => void): void {
    this.onPinCallback = callback
  }

  /**
   * **契約那一支**（`ViewHost.readSource`）——程式碼這一側交的是**文字**。
   *
   * 🔴 它交不出樹，而那**不是缺陷**：程式碼的樹是**解析出來的**
   * （`syncCodeToBlocks(code)` → `handleEditCode` → lifter），不在這個視圖手上。
   *
   * ⚠️ 第七十九條護欄第一次跑就是抓到這一顆：契約本來寫成
   * `extractSemanticTree(): SemanticNode`，而那會逼這個面板說謊。
   * > **「可以當真相來源」與「手上有一棵樹」是兩件事。**
   */
  readSource(): EditableSource {
    return { kind: 'code', code: this.getCode() }
  }

  getCode(): string {
    return this.editor?.getValue() ?? ''
  }

  setCode(code: string): void {
    if (!this.editor) return
    this.suppressChange = true
    this.editor.setValue(code)
    this.suppressChange = false
  }

  /** Set code while preserving cursor position, offsetting by a line delta */
  setCodePreserveCursor(code: string, linesDelta: number): void {
    if (!this.editor) return
    const pos = this.editor.getPosition()
    this.suppressChange = true
    this.editor.setValue(code)
    this.suppressChange = false
    if (pos) {
      const newLine = Math.max(1, pos.lineNumber + linesDelta)
      this.editor.setPosition({ lineNumber: newLine, column: pos.column })
    }
  }

  setReadOnly(readOnly: boolean): void {
    this.editor?.updateOptions({ readOnly })
  }

  /** Apply mobile-friendly options to reduce IME input issues */
  applyMobileOptions(): void {
    this.editor?.updateOptions({
      fontSize: 14,
      lineHeight: 20,
      quickSuggestions: false,
      suggestOnTriggerCharacters: false,
      acceptSuggestionOnCommitCharacter: false,
      wordBasedSuggestions: 'off',
      parameterHints: { enabled: false },
      hover: { enabled: false },
      accessibilitySupport: 'off',
      autoClosingBrackets: 'never',
      autoClosingQuotes: 'never',
      autoSurround: 'never',
      formatOnType: false,
      snippetSuggestions: 'none',
    })
    // Force focus on tap — mobile keyboards may not open otherwise
    const domNode = this.editor?.getDomNode()
    if (domNode) {
      domNode.addEventListener('pointerdown', () => {
        this.editor?.focus()
      }, { passive: true })
    }
  }

  /** Restore desktop editor options */
  applyDesktopOptions(): void {
    this.editor?.updateOptions({
      fontSize: 14,
      lineHeight: 19,
      quickSuggestions: { other: true, strings: false, comments: false },
      suggestOnTriggerCharacters: true,
      acceptSuggestionOnCommitCharacter: true,
      wordBasedSuggestions: 'currentDocument',
      parameterHints: { enabled: true },
      hover: { enabled: true },
    })
  }

  addHighlight(startLine: number, endLine: number, variant: 'block-to-code' | 'code-to-block' = 'block-to-code'): void {
    if (!this.editor) return
    this.highlightCollection?.clear()
    this.highlightCollection = null
    this.pendingHighlight = { startLine, endLine, variant }
    const suffix = variant === 'code-to-block' ? '-reverse' : ''
    this.highlightCollection = this.editor.createDecorationsCollection([{
      range: new monaco.Range(startLine, 1, endLine, 1),
      options: {
        isWholeLine: true,
        className: `monaco-line-highlight${suffix}`,
        linesDecorationsClassName: `monaco-line-highlight-gutter${suffix}`,
      },
    }])
    this.editor.revealLineInCenterIfOutsideViewport(startLine)
  }

  clearHighlight(): void {
    this.highlightCollection?.clear()
    this.highlightCollection = null
    // pendingHighlight preserved for cross-tab re-apply on mobile
  }

  /** Clear pending highlight — call when user explicitly interacts with code editor */
  dismissPendingHighlight(): void {
    this.pendingHighlight = null
  }

  /** Force layout and re-apply pending highlight (call after container becomes visible) */
  relayout(): void {
    if (!this.editor) return
    this.editor.layout()
    if (this.pendingHighlight) {
      const { startLine, endLine, variant } = this.pendingHighlight
      this.addHighlight(startLine, endLine, variant)
    }
  }

  getEditor(): monaco.editor.IStandaloneCodeEditor | null {
    return this.editor
  }

  revealLine(line: number): void {
    this.editor?.revealLineInCenter(line)
  }

  onBreakpointChange(callback: (breakpoints: number[]) => void): void {
    this.onBreakpointChangeCallback = callback
  }

  toggleBreakpoint(line: number): void {
    if (this.breakpoints.has(line)) {
      this.breakpoints.delete(line)
    } else {
      this.breakpoints.add(line)
    }
    this.renderBreakpoints()
    this.publishBreakpoints()
    this.onBreakpointChangeCallback?.(this.getBreakpoints())
  }

  getBreakpoints(): number[] {
    return Array.from(this.breakpoints).sort((a, b) => a - b)
  }

  clearBreakpoints(): void {
    this.breakpoints.clear()
    this.renderBreakpoints()
  }

  // ─── Ghost Line Support ───

  /**
   * Apply scaffold decorations based on ScaffoldResult.
   * - ghost items: show with faded style
   * - hidden items: hide using Monaco hidden areas
   * - editable items: no decoration (normal display)
   */
  applyScaffoldDecorations(code: string, scaffoldResult: ScaffoldResult): void {
    if (!this.editor) return

    this.ghostLineMap.clear()

    const lines = code.split('\n')
    const allItems = [
      ...scaffoldResult.imports,
      ...scaffoldResult.preamble,
      ...scaffoldResult.entryPoint,
      ...scaffoldResult.epilogue,
    ]

    const ghostDecorationData: monaco.editor.IModelDeltaDecoration[] = []

    for (const item of allItems) {
      // Find the line number for this scaffold item
      const lineIdx = lines.findIndex(l => l.trim() === item.code.trim())
      if (lineIdx === -1) continue
      const lineNum = lineIdx + 1

      this.ghostLineMap.set(lineNum, item)

      if (item.visibility === 'ghost') {
        ghostDecorationData.push({
          range: new monaco.Range(lineNum, 1, lineNum, 1),
          options: {
            isWholeLine: true,
            className: 'ghost-line',
            linesDecorationsClassName: 'ghost-line-gutter',
          },
        })
      }
      // 'hidden' and 'editable' items: no special decoration — code always shows complete
    }

    // Apply ghost decorations (L1 mode shows scaffold lines faded)
    this.ghostCollection?.clear()
    this.ghostCollection = this.editor.createDecorationsCollection(ghostDecorationData)
  }

  clearScaffoldDecorations(): void {
    if (!this.editor) return
    this.ghostCollection?.clear()
    this.ghostCollection = null
    this.ghostLineMap.clear()
  }

  private registerGhostHoverProvider(): void {
    this.hoverProvider = monaco.languages.registerHoverProvider('cpp', {
      provideHover: (_model, position) => {
        const item = this.ghostLineMap.get(position.lineNumber)
        if (!item || !item.reason) return null

        return {
          range: new monaco.Range(position.lineNumber, 1, position.lineNumber, 1),
          contents: [
            { value: `**Scaffold**: ${item.reason}` },
          ],
        }
      },
    })
  }

  private createClipboardBar(): void {
    const bar = document.createElement('div')
    bar.className = 'monaco-clipboard-bar'

    const copyBtn = document.createElement('button')
    copyBtn.className = 'clipboard-btn'
    copyBtn.textContent = '📋 複製'
    copyBtn.title = '複製全部程式碼'
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(this.getCode())
    })

    const pasteInsertBtn = document.createElement('button')
    pasteInsertBtn.className = 'clipboard-btn'
    pasteInsertBtn.textContent = '📥 插入'
    pasteInsertBtn.title = '在游標處插入剪貼簿內容'
    pasteInsertBtn.addEventListener('click', async () => {
      const text = await navigator.clipboard.readText()
      if (!this.editor || !text) return
      const position = this.editor.getPosition()
      if (position) {
        this.editor.executeEdits('clipboard-insert', [{
          range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
          text,
        }])
      }
    })

    const pasteReplaceBtn = document.createElement('button')
    pasteReplaceBtn.className = 'clipboard-btn'
    pasteReplaceBtn.textContent = '📋 覆蓋貼上'
    pasteReplaceBtn.title = '用剪貼簿內容取代全部程式碼'
    pasteReplaceBtn.addEventListener('click', async () => {
      const text = await navigator.clipboard.readText()
      if (!this.editor || !text) return
      const model = this.editor.getModel()
      if (model) {
        this.editor.executeEdits('clipboard-replace', [{
          range: model.getFullModelRange(),
          text,
        }])
      }
    })

    const undoBtn = document.createElement('button')
    undoBtn.className = 'clipboard-btn'
    undoBtn.textContent = '↩ 還原'
    undoBtn.title = '還原 (Undo)'
    undoBtn.addEventListener('click', () => {
      this.editor?.trigger('clipboard-bar', 'undo', null)
    })

    const redoBtn = document.createElement('button')
    redoBtn.className = 'clipboard-btn'
    redoBtn.textContent = '↪ 取消還原'
    redoBtn.title = '取消還原 (Redo)'
    redoBtn.addEventListener('click', () => {
      this.editor?.trigger('clipboard-bar', 'redo', null)
    })

    bar.appendChild(copyBtn)
    bar.appendChild(pasteInsertBtn)
    bar.appendChild(pasteReplaceBtn)
    bar.appendChild(undoBtn)
    bar.appendChild(redoBtn)

    // Insert bar before the editor container (at the top of the wrapper)
    this.container.insertBefore(bar, this.container.firstChild)
  }

  private renderBreakpoints(): void {
    if (!this.editor) return
    const decorations = Array.from(this.breakpoints).map(line => ({
      range: new monaco.Range(line, 1, line, 1),
      options: {
        isWholeLine: false,
        glyphMarginClassName: 'breakpoint-glyph',
      },
    }))
    this.breakpointCollection?.clear()
    this.breakpointCollection = this.editor.createDecorationsCollection(decorations)
  }

  dispose(): void {
    this.highlightCollection?.clear()
    this.ghostCollection?.clear()
    this.breakpointCollection?.clear()
    this.hoverProvider?.dispose()
    this.editor?.dispose()
    this.editor = null
  }
}
