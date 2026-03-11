import * as monaco from 'monaco-editor'
import type { ViewHost, ViewCapabilities, ViewConfig, SemanticUpdateEvent, ExecutionStateEvent } from '../../core/view-host'
import type { SemanticBus } from '../../core/semantic-bus'
import type { ScaffoldResult, ScaffoldItem } from '../../core/program-scaffold'

export class MonacoPanel implements ViewHost {
  readonly viewId = 'monaco-panel'
  readonly viewType = 'monaco'
  readonly capabilities: ViewCapabilities = {
    editable: true,
    needsLanguageProjection: true,
    consumedAnnotations: [],
  }

  private editor: monaco.editor.IStandaloneCodeEditor | null = null
  private container: HTMLElement
  private onChangeCallback: ((code: string) => void) | null = null
  private onCursorChangeCallback: ((line: number) => void) | null = null
  private suppressChange = false
  private highlightCollection: monaco.editor.IEditorDecorationsCollection | null = null
  private pendingHighlight: { startLine: number; endLine: number; variant: 'block-to-code' | 'code-to-block' } | null = null
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

  onSemanticUpdate(event: SemanticUpdateEvent & { source?: string; code?: string; scaffoldResult?: ScaffoldResult }): void {
    if (event.source === 'blocks' && event.code !== undefined) {
      this.setCode(event.code)
      if (event.scaffoldResult) {
        this.applyScaffoldDecorations(event.code, event.scaffoldResult)
      }
    }
  }

  onExecutionState(_event: ExecutionStateEvent): void {
    // MonacoPanel doesn't handle execution state directly
  }

  connectBus(bus: SemanticBus): void {
    bus.on('semantic:update', (data) => this.onSemanticUpdate(data))
  }

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
      scrollBeyondLastLine: false,
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
    })
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
