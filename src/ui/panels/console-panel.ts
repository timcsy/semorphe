import * as Blockly from 'blockly'
import type { ViewHost, ViewCapabilities, ViewConfig, SemanticUpdateEvent, ExecutionStateEvent } from '../../core/view-host'
import type { SemanticBus } from '../../core/semantic-bus'

export type ConsoleSignal = 'SIGINT' | 'EOF'

export class ConsolePanel implements ViewHost {
  readonly viewId = 'console-panel'
  readonly viewType = 'console'
  readonly capabilities: ViewCapabilities = {
    editable: false,
    needsLanguageProjection: false,
    consumedAnnotations: [],
  }

  private container: HTMLElement
  private outputEl: HTMLElement
  private statusEl: HTMLElement
  private inputRow: HTMLElement | null = null
  private lines: string[] = []
  private inputResolve: ((value: string) => void) | null = null
  /** The current line element being written to (not yet terminated by \n) */
  private currentLineEl: HTMLElement | null = null
  /** Inline input element (terminal-style cursor in the output area) */
  private inlineInput: HTMLInputElement | null = null
  private inlineInputLine: HTMLElement | null = null
  private signalHandler: ((signal: ConsoleSignal) => void) | null = null
  /** Queued input lines from multi-line paste */
  private pendingInputLines: string[] = []
  private onInputShowCallback: ((input: HTMLInputElement) => void) | null = null
  private onInputHideCallback: (() => void) | null = null

  constructor(container: HTMLElement) {
    this.container = container
    this.container.classList.add('console-panel')

    this.outputEl = document.createElement('div')
    this.outputEl.className = 'console-output'
    this.container.appendChild(this.outputEl)

    this.statusEl = document.createElement('div')
    this.statusEl.className = 'console-status'
    this.container.appendChild(this.statusEl)

    // Click on output area focuses the inline input (if active)
    this.outputEl.addEventListener('click', () => {
      this.inlineInput?.focus()
    })

    // Make output area focusable for keyboard events
    this.outputEl.tabIndex = -1
    this.outputEl.addEventListener('keydown', (e) => this.handleCtrlKey(e))
  }

  async initialize(_config: ViewConfig): Promise<void> {
    // ViewHost lifecycle — ConsolePanel initializes in constructor
  }

  dispose(): void {
    this.clear()
  }

  onSemanticUpdate(_event: SemanticUpdateEvent): void {
    // ConsolePanel doesn't handle semantic updates
  }

  /**
   * ⚠️ 這裡原本是一個空樁。而在它是空樁的期間，**執行器替它做了這件事**
   * ——`consolePanel.setStatus(Blockly.Msg['EXEC_STATUS_RUNNING'] || 'Running', 'running')`，
   * 在 `execution-controller.ts` 裡出現 **24 次**。
   *
   * > **一個知道對方要顯示什麼字的發送端，換不掉那個接收端。**
   *
   * 現在執行器只說「狀態是什麼、為什麼」（`status` ＋ `reason`），
   * **文案、i18n 鍵、CSS class 全部是這個視圖自己的事**。
   *
   * ⚠️ `EXEC_STATUS_WAITING` 與 `EXEC_STATUS_ABORTED` **兩個 i18n 鍵不存在**
   * ——所以中文介面下它們一直顯示英文 fallback。那是搬家前就有的缺陷，
   * 這裡**照原樣搬**（`component-encapsulate`：搬移不重寫，要重寫在另一個 commit）。
   */
  onExecutionState(event: ExecutionStateEvent): void {
    const msg = (key: string, fallback2: string): string =>
      (Blockly.Msg[key] as string | undefined) || fallback2

    if (event.reason === 'awaiting-input') {
      this.setStatus(msg('EXEC_STATUS_WAITING', 'Waiting for input...'), 'running')
      return
    }
    if (event.reason === 'aborted') {
      this.setStatus(msg('EXEC_STATUS_ABORTED', 'Interrupted'), '')
      return
    }
    switch (event.status) {
      case 'running':
        this.setStatus(msg('EXEC_STATUS_RUNNING', 'Running'), 'running')
        break
      case 'paused':
        this.setStatus(
          event.reason === 'breakpoint'
            ? msg('EXEC_STATUS_PAUSED_BREAKPOINT', 'Paused (breakpoint)')
            : msg('EXEC_STATUS_PAUSED', 'Paused'),
          'running',
        )
        break
      case 'completed':
        this.setStatus(msg('EXEC_STATUS_COMPLETED', 'Completed'), 'completed')
        break
      case 'error':
        this.setStatus(msg('EXEC_STATUS_ERROR', 'Error'), 'error')
        break
      case 'idle':
        this.setStatus(msg('EXEC_STATUS_IDLE', 'Ready'), '')
        break
    }
  }

  /**
   * ⚠️ `execution:output` **不在 `ViewHost` 契約上**，所以這個視圖自己接。
   * 那是刻意的：契約只放**每個視圖都該回答**的兩件事
   * （語義更新、執行狀態），輸出串流只有主控台在意。
   */
  connectBus(bus: SemanticBus): void {
    bus.on('execution:output', (data) => {
      if (data.stream === 'stderr') this.error(data.text)
      else this.write(data.text)
    })
  }

  /** Register a handler for terminal signals (Ctrl+C → SIGINT, Ctrl+D → EOF) */
  onSignal(handler: ((signal: ConsoleSignal) => void) | null): void {
    this.signalHandler = handler
  }

  /** Called when inline input is shown (for virtual keyboard integration) */
  onInputShow(callback: (input: HTMLInputElement) => void): void {
    this.onInputShowCallback = callback
  }

  /** Called when inline input is hidden/submitted */
  onInputHide(callback: () => void): void {
    this.onInputHideCallback = callback
  }

  private handleCtrlKey(e: KeyboardEvent): void {
    if (!e.ctrlKey) return
    if (e.key === 'c') {
      e.preventDefault()
      // Remove inline input immediately so user sees the program stopped
      this.removeInlineInput()
      this.inputResolve = null
      this.write('^C\n')
      this.signalHandler?.('SIGINT')
    } else if (e.key === 'd') {
      e.preventDefault()
      if (this.inlineInput && this.inputResolve) {
        // EOF: submit special value
        this.submitInlineInput('\x04')
      }
      this.signalHandler?.('EOF')
    }
  }

  /**
   * Streaming write — appends text to current line, splits on \n.
   * Use this for interpreter output where multiple write() calls
   * compose a single line (e.g., cout << "hello, " << s << endl).
   */
  write(text: string): void {
    if (!text) return

    const parts = text.split('\n')

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]

      if (i > 0) {
        // A \n was encountered — finalize current line
        this.currentLineEl = null
      }

      if (part.length > 0) {
        if (!this.currentLineEl) {
          this.currentLineEl = document.createElement('div')
          this.currentLineEl.className = 'console-line'
          this.outputEl.appendChild(this.currentLineEl)
        }
        this.currentLineEl.textContent += part
      }
    }

    this.scrollToBottom()
  }

  /** Log a complete line (always gets its own div, like traditional console) */
  log(text: string): void {
    this.lines.push(text)
    this.currentLineEl = null
    const line = document.createElement('div')
    line.className = 'console-line'
    line.textContent = text
    this.outputEl.appendChild(line)
    this.currentLineEl = null
    this.scrollToBottom()
  }

  error(text: string): void {
    this.lines.push(`[ERROR] ${text}`)
    this.currentLineEl = null
    const line = document.createElement('div')
    line.className = 'console-line console-error'
    line.textContent = text
    this.outputEl.appendChild(line)
    this.currentLineEl = null
    this.scrollToBottom()
  }

  clear(): void {
    this.lines = []
    this.outputEl.innerHTML = ''
    this.currentLineEl = null
    this.pendingInputLines = []
    this.removeInlineInput()
    this.removeInputRow()
    this.setStatus('')
  }

  setStatus(text: string, type: '' | 'running' | 'error' | 'completed' = ''): void {
    this.statusEl.textContent = text
    this.statusEl.className = `console-status ${type}`
  }

  promptInput(prompt?: string): Promise<string> {
    return new Promise((resolve) => {
      if (prompt) {
        this.log(prompt)
      }

      // If there are queued lines from a multi-line paste, auto-submit immediately
      if (this.pendingInputLines.length > 0) {
        const line = this.pendingInputLines.shift()!
        // Echo the auto-submitted line
        if (!this.currentLineEl) {
          this.currentLineEl = document.createElement('div')
          this.currentLineEl.className = 'console-line'
          this.outputEl.appendChild(this.currentLineEl)
        }
        const echo = document.createElement('span')
        echo.className = 'console-input-echo'
        echo.textContent = line
        this.currentLineEl.appendChild(echo)
        this.currentLineEl = null
        this.scrollToBottom()
        resolve(line)
        return
      }

      this.inputResolve = resolve

      this.removeInlineInput()
      this.removeInputRow()

      // Append inline input to the current line (same line as previous output)
      // If no current line exists, create one
      if (!this.currentLineEl) {
        this.currentLineEl = document.createElement('div')
        this.currentLineEl.className = 'console-line'
        this.outputEl.appendChild(this.currentLineEl)
      }
      // Convert textContent to a text node so we can append input alongside it
      if (this.currentLineEl.childNodes.length === 0 && this.currentLineEl.textContent) {
        const text = this.currentLineEl.textContent
        this.currentLineEl.textContent = ''
        this.currentLineEl.appendChild(document.createTextNode(text))
      }
      // Make it inline-flex so text and input sit on the same line
      this.currentLineEl.style.display = 'flex'
      this.inlineInputLine = this.currentLineEl

      const input = document.createElement('input')
      input.className = 'console-inline-input'
      input.type = 'text'
      input.spellcheck = false
      input.autocomplete = 'off'

      input.addEventListener('keydown', (e) => {
        if (e.ctrlKey && (e.key === 'c' || e.key === 'd')) {
          e.stopPropagation()
          this.handleCtrlKey(e)
          return
        }
        if (e.key === 'Enter') {
          const val = input.value
          this.submitInlineInput(val)
        }
      })

      input.addEventListener('paste', (e) => {
        const pasted = e.clipboardData?.getData('text')
        if (!pasted || !pasted.includes('\n')) return
        e.preventDefault()
        const lines = pasted.split('\n')
        // First line: combine with existing input text and submit
        const firstLine = input.value + lines[0]
        // Queue remaining non-empty lines (preserve empty lines for blank input)
        this.pendingInputLines.push(...lines.slice(1))
        this.submitInlineInput(firstLine)
      })

      this.inlineInputLine.appendChild(input)
      this.inlineInput = input

      // Show a hint in the status bar
      // ⚠️ 這裡原本硬編中文 `'等待輸入...'`——而執行器那邊查的是
      // `Blockly.Msg['EXEC_STATUS_WAITING']`（一個**不存在的鍵**，永遠落到英文退路）。
      // 於是同一個狀態有兩份文案，而它們**連語言都不一樣**，
      // 只因為這一份後執行所以看起來是對的。
      this.setStatus((Blockly.Msg['EXEC_STATUS_WAITING'] as string | undefined) || 'Waiting for input...', 'running')

      this.scrollToBottom()
      // Notify virtual keyboard integration before focusing
      this.onInputShowCallback?.(input)
      input.focus()
    })
  }

  private submitInlineInput(val: string): void {
    // Replace the inline input element with a text span showing the typed value
    if (this.inlineInput) {
      const echo = document.createElement('span')
      echo.className = 'console-input-echo'
      echo.textContent = val
      this.inlineInput.replaceWith(echo)
    }
    this.inlineInput = null
    this.inlineInputLine = null
    // Start a new line after input
    this.currentLineEl = null

    this.onInputHideCallback?.()

    if (this.inputResolve) {
      this.inputResolve(val)
      this.inputResolve = null
    }
  }

  showOutputUpTo(count: number): void {
    const children = this.outputEl.children
    for (let i = 0; i < children.length; i++) {
      const el = children[i] as HTMLElement
      el.style.display = i < count ? '' : 'none'
    }
  }

  getLines(): string[] {
    return [...this.lines]
  }

  /** Submit the current inline input (used by virtual keyboard) */
  submitCurrentInput(): void {
    if (this.inlineInput) {
      this.submitInlineInput(this.inlineInput.value)
    }
  }

  /** Get the current inline input element (for virtual keyboard integration) */
  getInlineInput(): HTMLInputElement | null {
    return this.inlineInput
  }

  /** Copy all visible output text to clipboard */
  copyOutput(): void {
    const text = Array.from(this.outputEl.querySelectorAll('.console-line'))
      .map(el => el.textContent ?? '')
      .join('\n')
    navigator.clipboard.writeText(text)
  }

  getElement(): HTMLElement {
    return this.container
  }

  private removeInlineInput(): void {
    const hadInput = this.inlineInput !== null
    if (this.inlineInputLine) {
      this.inlineInputLine.remove()
      this.inlineInputLine = null
    }
    this.inlineInput = null
    if (hadInput) this.onInputHideCallback?.()
  }

  private removeInputRow(): void {
    if (this.inputRow) {
      this.inputRow.remove()
      this.inputRow = null
    }
  }

  private scrollToBottom(): void {
    this.outputEl.scrollTop = this.outputEl.scrollHeight
  }
}
