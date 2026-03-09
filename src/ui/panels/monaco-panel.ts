import * as monaco from 'monaco-editor'
import type { ViewHost, ViewCapabilities, ViewConfig, SemanticUpdateEvent, ExecutionStateEvent } from '../../core/view-host'
import type { SemanticBus } from '../../core/semantic-bus'

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
  private bus: SemanticBus | null = null
  private highlightDecorations: string[] = []
  private breakpoints: Set<number> = new Set()
  private breakpointDecorations: string[] = []
  private onBreakpointChangeCallback: ((breakpoints: number[]) => void) | null = null

  constructor(container: HTMLElement, bus?: SemanticBus) {
    this.container = container
    this.bus = bus ?? null
  }

  async initialize(_config: ViewConfig): Promise<void> {
    // ViewHost lifecycle — actual init handled by init() method
  }

  onSemanticUpdate(event: SemanticUpdateEvent & { source?: string; code?: string }): void {
    if (event.source === 'blocks' && event.code !== undefined) {
      this.setCode(event.code)
    }
  }

  onExecutionState(_event: ExecutionStateEvent): void {
    // MonacoPanel doesn't handle execution state directly
  }

  connectBus(bus: SemanticBus): void {
    this.bus = bus
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
        // Emit to bus if connected
        if (this.bus) {
          this.bus.emit('edit:code', { code: this.getCode() })
        }
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
        if (line) this.toggleBreakpoint(line)
      }
    })
  }

  onChange(callback: (code: string) => void): void {
    this.onChangeCallback = callback
  }

  onCursorChange(callback: (line: number) => void): void {
    this.onCursorChangeCallback = callback
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

  setReadOnly(readOnly: boolean): void {
    this.editor?.updateOptions({ readOnly })
  }

  addHighlight(startLine: number, endLine: number, variant: 'block-to-code' | 'code-to-block' = 'block-to-code'): void {
    if (!this.editor) return
    this.clearHighlight()
    const suffix = variant === 'code-to-block' ? '-reverse' : ''
    this.highlightDecorations = this.editor.deltaDecorations([], [{
      range: new monaco.Range(startLine, 1, endLine, 1),
      options: {
        isWholeLine: true,
        className: `monaco-line-highlight${suffix}`,
        linesDecorationsClassName: `monaco-line-highlight-gutter${suffix}`,
      },
    }])
  }

  clearHighlight(): void {
    if (!this.editor) return
    this.highlightDecorations = this.editor.deltaDecorations(this.highlightDecorations, [])
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

  private renderBreakpoints(): void {
    if (!this.editor) return
    const decorations = Array.from(this.breakpoints).map(line => ({
      range: new monaco.Range(line, 1, line, 1),
      options: {
        isWholeLine: false,
        glyphMarginClassName: 'breakpoint-glyph',
      },
    }))
    this.breakpointDecorations = this.editor.deltaDecorations(this.breakpointDecorations, decorations)
  }

  dispose(): void {
    this.editor?.dispose()
    this.editor = null
  }
}
