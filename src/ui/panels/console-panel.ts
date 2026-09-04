import { msg } from '../../core/messages'
import type { ViewHost, ViewCapabilities, ViewConfig, SemanticUpdateEvent, ExecutionStateEvent } from '../../core/view-host'
import type { SemanticBus } from '../../core/semantic-bus'
import { revealForOutput, type ConsoleSurface } from '../../core/host/console-surface'
import type { OutputComparison } from '../../core/lesson'

export type ConsoleSignal = 'SIGINT' | 'EOF'

export class ConsolePanel implements ViewHost {
  readonly viewId = 'console-panel'
  readonly viewType = 'console'
  readonly capabilities: ViewCapabilities = {
    editable: false,
    needsLanguageProjection: false,
    consumedAnnotations: [],
    /** 主控台＝**現在裡面裝了什麼**——`concepts/理解的層次.md` */
    layer: 'state' as const,
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

  /**
   * 這個宿主上「主控台這一格」的開關（spec 171）。
   *
   * ⚠️ `null` ＝ 這個宿主沒有可關的主控台——那時 `revealForOutput` 什麼都不做。
   */
  private surface: ConsoleSurface | null = null

  setSurface(surface: ConsoleSurface | null): void {
    this.surface = surface
  }
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
   * ——`consolePanel.setStatus(msg('EXEC_STATUS_RUNNING', 'Running'), 'running')`，
   * 在 `execution-controller.ts` 裡出現 **24 次**。
   *
   * > **一個知道對方要顯示什麼字的發送端，換不掉那個接收端。**
   *
   * 現在執行器只說「狀態是什麼、為什麼」（`status` ＋ `reason`），
   * **文案、i18n 鍵、CSS class 全部是這個視圖自己的事**。
   *
   * 🪦 **這裡本來寫著「`EXEC_STATUS_WAITING` 與 `EXEC_STATUS_ABORTED` 兩個
   * i18n 鍵不存在」——2026-08-26 查證，兩個都在**（`i18n/{zh-TW,en}/blocks.json:153,155`）。
   * 補上的那一刀沒有回頭改這段話。
   *
   * > **一句描述缺陷的註解，不會因為缺陷被修好而過期——它會繼續被相信。**
   *
   * ⚠️ 查字改走 `core/messages` 的埠（2026-08-26，第七十四條護欄）：
   * 這個面板為了查三個字拉進整個 Blockly，而它與積木沒有任何關係。
   */
  onExecutionState(event: ExecutionStateEvent): void {
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
  private outputCb: ((text: string) => void) | null = null
  private clearCb: (() => void) | null = null

  /**
   * 有輸出時通知——🔴 **給「主控台在宿主那邊」的宿主用**。
   *
   * ⚠️ 它是**鏡射**不是搬家：面板那一格仍然自己畫。
   * 由 `HostProfile.controlSurfaces.output` 決定那一格建不建。
   */
  onOutput(cb: ((text: string) => void) | null): void {
    this.outputCb = cb
  }

  /** 程式開始等輸入了。⚠️ 給「唯讀的主控台」的宿主用。 */
  onInputRequested(cb: ((prompt: string) => void) | null): void {
    this.inputRequestCb = cb
  }

  private inputRequestCb: ((prompt: string) => void) | null = null

  /** 清空時通知（終端機那側也要跟著清）。 */
  onClear(cb: (() => void) | null): void {
    this.clearCb = cb
  }

  /**
   * 從外面餵一行輸入進來（終端機打的字）。
   *
   * 🔴 **與面板那顆輸入框走同一個 resolve**——不是第二條路。
   * ⚠️ 沒有人在等的時候**排進佇列**，不是丟掉：終端機可以先貼好幾行。
   */
  feedInput(line: string): void {
    if (this.inputResolve) {
      const resolve = this.inputResolve
      this.inputResolve = null
      this.removeInlineInput()
      this.removeInputRow()
      resolve(line)
      return
    }
    this.pendingInputLines.push(line)
  }

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
    // 🔴 **關著就先把它叫回來**（spec 171）。使用者可以關掉主控台，
    //    而「有輸出時它自己回來」是那個自由的代價——不然使用者會
    //    **看不到程式在說什麼**，那與「程式當掉了」長得一樣。
    //
    // ⚠️ 這一句在**共用的這一側**，不是各宿主各寫一份：
    //    兩個宿主各寫一次的話，其中一個遲早會漏。
    revealForOutput(this.surface)
    // 🔴 **鏡射給宿主**（2026-08-25）——⚠️ 放在最前面：底下有多個提早
    //    return 的分支，而「有些輸出沒有出現在宿主那側」比「完全沒接上」
    //    難查得多。
    this.outputCb?.(text)

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
    this.outputCb?.(text + '\n')
    this.lines.push(text)
    this.currentLineEl = null
    const line = document.createElement('div')
    line.className = 'console-line'
    line.textContent = text
    this.outputEl.appendChild(line)
    this.currentLineEl = null
    this.scrollToBottom()
  }

  /**
   * **裁判**——這一課要的輸出，與學生實際跑出來的，並排。
   *
   * ## 🔴 為什麼不是一個 ✅／❌
   *
   * `Hattie & Timperley`：針對**人**的回饋（分數、讚美）效果最差，針對**任務與過程**
   * 的最好。而「❌ 錯」是**不能行動**的——它沒告訴學生下一步。
   *
   * > **回饋要說的是「你少了第 3 行」，不是「你答錯了」。**
   *
   * ⚠️ 而它說「**還沒**」不說「錯」：初學者的多數「錯」其實是還沒完成，
   * 前者指向下一步，後者指向自己。
   *
   * ⚠️ **這裡不判寫法**——用 `while` 還是 `for` 不是對錯，那是另一個話題。
   */
  showVerdict(result: OutputComparison, taskTitle?: string): void {
    this.currentLineEl = null
    const box = document.createElement('div')
    box.className = `console-verdict ${result.passed ? 'passed' : 'not-yet'}`

    const head = document.createElement('div')
    head.className = 'console-verdict-head'
    // 🔴 **說出是哪一題**（2026-09-04）——「✅ 你完成了〈練習 1〉」比
    //    「✅ 對了」多了一件事：**他知道自己完成的是什麼**。
    //
    // ⚠️ 而在一課有好幾題的時候，不說題名的祝賀是**有歧義的**：
    //    他會不知道剛才那個勾算在哪一題頭上。
    const named = taskTitle !== undefined && taskTitle !== ''
    head.textContent = result.passed
      ? (named ? `✅ 你完成了〈${taskTitle}〉` : msg('CHECK_PASSED', '✅ 輸出對了'))
      : (named ? `〈${taskTitle}〉還沒對——看看差在哪` : msg('CHECK_NOT_YET', '還沒對——看看差在哪'))
    box.appendChild(head)

    if (!result.passed) {
      const table = document.createElement('div')
      table.className = 'console-verdict-diff'
      const cell = (text: string, cls: string): HTMLElement => {
        const d = document.createElement('div')
        d.className = cls
        d.textContent = text
        return d
      }
      table.append(
        cell(msg('CHECK_YOURS', '你的輸出'), 'h'),
        // ⚠️ 「這一課要的」→「這一題要的」：一課有好幾題之後，前者是錯的
        cell(msg('CHECK_WANTED', '這一題要的'), 'h'),
      )
      for (const l of result.lines) {
        // ⚠️ 空字串會讓那一格塌掉——用一個看得見的佔位
        table.append(
          cell(l.got ?? '—', `c ${l.kind}`),
          cell(l.want ?? '—', `c ${l.kind}`),
        )
      }
      box.appendChild(table)
    }
    this.outputEl.appendChild(box)
    this.scrollToBottom()
  }

  /**
   * 過了之後，**問他要不要換到下一題**——而不是替他換。
   *
   * 🔴 自動切下一題會讓他下一次執行**突然被另一題評價**，而他不會知道
   * 是什麼時候換的。一句話 ＋ 一顆按鈕，他按了才算。
   *
   * > **一個會自己改變「我現在在做什麼」的系統，
   * > 會讓使用者失去對回饋的信任——因為他不知道那句話在對誰說。**
   */
  offerNextTask(title: string, onSwitch: () => void): void {
    this.currentLineEl = null
    const row = document.createElement('div')
    row.className = 'console-next-task'
    const text = document.createElement('span')
    text.textContent = `下一題：${title}`
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'console-next-task-btn'
    btn.textContent = '切過去'
    btn.addEventListener('click', () => {
      // ⚠️ **按過就不能再按**：它描述的是「當時的下一題」，
      //    而按完之後那句話已經過期了。
      btn.disabled = true
      btn.textContent = '已切換'
      onSwitch()
    })
    row.append(text, btn)
    this.outputEl.appendChild(row)
    this.scrollToBottom()
  }

  /**
   * **跑之前先問一句**——回傳他猜的，跳過的話回 `null`。
   *
   * ## 🔴 為什麼問在主控台，不是跳一個框
   *
   * 答案等一下就出現在這裡。**問題與揭曉在同一個地方**，那個 diff 才會
   * 出現在他剛才寫的那句話底下——而跳出來的框做不到這件事。
   *
   * ⚠️ 而且主控台**本來就有一個會停下來等人的輸入框**（`promptInput`），
   * 學生對「這裡會問我問題」這件事已經熟了。
   *
   * ## ⚠️ 跳過的按鈕一定要在，而且不准藏起來
   *
   * 強迫產生的是順從，不是思考——他會打 `aaa` 混過去，而那比不問更糟：
   * 它教會學生「這個框是一個要繞過的關卡」。
   */
  askPrediction(kind: 'output' | 'iterations', prompt: string): Promise<string | null> {
    this.currentLineEl = null
    return new Promise((resolve) => {
      const box = document.createElement('div')
      box.className = 'console-predict'

      const head = document.createElement('div')
      head.className = 'console-predict-head'
      head.textContent = `🤔 跑之前先猜一下：${prompt}`
      box.appendChild(head)

      const row = document.createElement('div')
      row.className = 'console-predict-row'
      // ⚠️ 兩種形式**用不同的欄位**：一行數字用 `input`，多行輸出用 `textarea`
      //    ——把「猜 3 行輸出」塞進一個單行欄位，學生會以為只能寫一行。
      const field: HTMLInputElement | HTMLTextAreaElement = kind === 'iterations'
        ? Object.assign(document.createElement('input'), { type: 'number', min: '0' })
        : Object.assign(document.createElement('textarea'), { rows: 3 })
      field.className = 'console-predict-input'
      field.placeholder = kind === 'iterations' ? '例如 5' : '一行一行寫，就像它會印出來的樣子'

      const send = document.createElement('button')
      send.type = 'button'
      send.className = 'console-predict-btn'
      send.textContent = '就這樣，跑吧'
      const skip = document.createElement('button')
      skip.type = 'button'
      skip.className = 'console-predict-skip'
      skip.textContent = '跳過'

      let done = false
      const finish = (v: string | null): void => {
        if (done) return
        done = true
        // 🔴 **收掉輸入、留下他寫的那一句**——`clear()` 等一下會把整個主控台清空，
        //    所以這裡不必自己刪；而在那之前的這一瞬間，他要看得到自己按了什麼。
        field.disabled = true
        send.disabled = true
        skip.disabled = true
        resolve(v)
      }
      send.addEventListener('click', () => finish(field.value))
      skip.addEventListener('click', () => finish(null))
      field.addEventListener('keydown', ((e: KeyboardEvent) => {
        // ⚠️ 單行的 Enter 送出；多行的 Enter 是換行（那是它的重點），要 Ctrl/⌘+Enter
        if (e.key !== 'Enter') return
        if (kind === 'iterations' || e.metaKey || e.ctrlKey) { e.preventDefault(); finish(field.value) }
      }) as EventListener)

      row.append(field, send, skip)
      box.appendChild(row)
      this.outputEl.appendChild(box)
      this.scrollToBottom()
      field.focus()
    })
  }

  /**
   * **揭曉**——把「你猜的」與「機器做的」並排。
   *
   * 🔴 猜對了要**比程式跑對更大聲**：它證明他腦子裡那台機器是對的，
   * 而那正是這整件事要教的東西。
   *
   * ⚠️ 猜錯了**不說「錯」**：說的是「機器做的跟你想的不一樣」。
   */
  showPrediction(guess: string, actual: string, right: boolean): void {
    this.currentLineEl = null
    const box = document.createElement('div')
    box.className = `console-predict-result ${right ? 'right' : 'differs'}`

    const head = document.createElement('div')
    head.className = 'console-verdict-head'
    head.textContent = right
      ? '🎯 你猜對了——你腦子裡那台機器是對的'
      : '機器做的跟你想的不一樣——差在這裡'
    box.appendChild(head)

    if (!right) {
      const table = document.createElement('div')
      table.className = 'console-verdict-diff'
      const cell = (t: string, cls: string): HTMLElement => {
        const d = document.createElement('div')
        d.className = cls
        d.textContent = t
        return d
      }
      table.append(cell('你猜的', 'h'), cell('它實際做的', 'h'))
      table.append(cell(guess === '' ? '—' : guess, 'c different'), cell(actual, 'c different'))
      box.appendChild(table)
    }
    this.outputEl.appendChild(box)
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
    this.clearCb?.()
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
      // 🔴 **告訴宿主「現在在等輸入」**——⚠️ 只有在宿主用【編輯器】當主控台時
      //    它才需要知道：終端機自己就收得到打字，而編輯器是唯讀的。
      //    處置在主行程（`vscode/panel.ts`）——這裡只是說一聲。
      this.inputRequestCb?.(prompt ?? '')

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
      // ⚠️ 這裡原本硬編中文 `'等待輸入...'`，而執行器那邊查 `EXEC_STATUS_WAITING`
      // ——於是同一個狀態有兩份文案，只因為這一份後執行所以看起來是對的。
      // 🔴 **兩份文案要走同一條路**：現在兩邊都是 `msg(鍵, 退路)`。
      this.setStatus(msg('EXEC_STATUS_WAITING', 'Waiting for input...'), 'running')

      this.scrollToBottom()
      // Notify virtual keyboard integration before focusing
      // 🔴 **等輸入也算輸出**——`cin` 的提示不出現的話，
      //    使用者會以為程式當掉了。
      revealForOutput(this.surface)
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
