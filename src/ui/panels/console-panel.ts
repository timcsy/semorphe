export type ConsoleSignal = 'SIGINT' | 'EOF'

export class ConsolePanel {
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

  /** Register a handler for terminal signals (Ctrl+C → SIGINT, Ctrl+D → EOF) */
  onSignal(handler: ((signal: ConsoleSignal) => void) | null): void {
    this.signalHandler = handler
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
      this.inputResolve = resolve

      if (prompt) {
        this.log(prompt)
      }

      this.removeInlineInput()
      this.removeInputRow()

      // Create an inline input line inside the output area (terminal-style)
      this.inlineInputLine = document.createElement('div')
      this.inlineInputLine.className = 'console-line console-inline-input-line'

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

      this.inlineInputLine.appendChild(input)
      this.outputEl.appendChild(this.inlineInputLine)
      this.inlineInput = input

      // Show a hint in the status bar
      this.setStatus('等待輸入...', 'running')

      this.scrollToBottom()
      input.focus()
    })
  }

  private submitInlineInput(val: string): void {
    // Replace the inline input with the typed text
    if (this.inlineInputLine) {
      this.inlineInputLine.textContent = val
      this.inlineInputLine.classList.remove('console-inline-input-line')
      this.inlineInputLine.classList.add('console-input-echo')
    }
    this.inlineInput = null
    this.inlineInputLine = null
    this.currentLineEl = null

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

  getElement(): HTMLElement {
    return this.container
  }

  private removeInlineInput(): void {
    if (this.inlineInputLine) {
      this.inlineInputLine.remove()
      this.inlineInputLine = null
    }
    this.inlineInput = null
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
