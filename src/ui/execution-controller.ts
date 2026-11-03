import { RUN_MODES } from '../core/host/controls'
import * as Blockly from 'blockly'
import type { BoardPinModel } from '../core/types'
import { openSession, SessionStop, type ExecutionSession, type Outcome, type SessionInput, type SessionOptions, type Stop } from '../core/capabilities'
import { DebugToolbar } from './debug-toolbar'
import type { StepInfo, ExecutionSpeed } from '../core/execution'
import { showQuickPick } from './toolbar/quick-pick'
import { msg } from '../core/messages'
import { showToast } from './toolbar/toast'
import type { BlocklyPanel } from './panels/blockly-panel'
import type { CodeView } from '../core/host/code-view'
import type { ConsolePanel } from '../panels/console/view'
import { canExecute } from '../core/diagnostics'
import { describeExecutionRefusal, describeUnknownPause, describeUnknownContinued, describeSetVariableRefused, describeInterventions } from '../core/refusal-message'
// 🔴 **不得直接推 `e.message`**——那是給開發者看的湊合字串（身分 ＋ JSON）。
// 三個顯示點各查一次表就是三個會忘記的地方，所以收成一個具名函式，
// 而第四十四條護欄的第二支測試正是「不得有人繞過它」。
import { describeRuntimeStop } from './runtime-message'
import type { SemanticNode } from '../core/types'
import type { VariablePanel } from '../panels/variables/view'
import type { BottomPanel } from './layout/bottom-panel'
import type { SyncController } from '../core/sync/sync-controller'
import type { SemanticBus } from '../core/sync/semantic-bus'
import type { ExecutionReason } from '../core/sync/view-host'
import type { ExecutionStatus } from '../core/execution'

export interface ExecutionPanels {
  blocklyPanel: BlocklyPanel | null
  codeView: CodeView | null
  consolePanel: ConsolePanel | null
  variablePanel: VariablePanel | null
  bottomPanel: BottomPanel | null
  syncController: SyncController | null
}

export class ExecutionController {
  private panels: ExecutionPanels
  private bus: SemanticBus | undefined
  /** 有斷點的節點。由程式碼視圖翻譯後推來——見 `semantic-bus.ts` 的 `execution:breakpoints`。 */
  private breakpointNodes = new Set<string>()
  /** 目前這一次執行（spec 183：DAP 的形狀，宿主下指令）。 */
  private session: ExecutionSession | null = null
  /** 每一次開跑（或停止）加一——「準備中」的等待迴圈用它知道自己還算不算數（spec 205 T003） */
  private runId = 0
  /** 等執行的模組準備好的上限與間隔：建置時編好的模組只是下載（通常幾秒），開發模式現場編約 20 秒 */
  static PREPARE_TIMEOUT_MS = 120_000
  static PREPARE_POLL_MS = 400
  private mode: 'run' | 'debug' | 'step' | 'animate' = 'run'
  /** 自動往下走的間隔（毫秒）；null ＝ 每停一次就等使用者。 */
  private auto: number | null = null
  private lastAnimateDelay: number | null = null
  private pauseRequested = false
  /** 停著等使用者的下一個指令。 */
  private commandResolve: ((cmd: 'step' | 'continue' | 'stop') => void) | null = null
  /** 加速／跳出：還在這一群裡就直接往下走，不停。 */
  private skipIds: Set<string> | null = null
  private currentNodeId: string | null = null
  /** 上一次執行從外面拿到的東西（重播用）。 */
  private lastInputs: readonly SessionInput[] = []
  private currentBoard?: () => BoardPinModel | undefined
  /** 交給形式化提供者（Cella）的那一份——組裝點才知道骨架積木、目標、風格、骨架（spec 183）。 */
  private formalContext?: (tree: SemanticNode) => SessionOptions['formal']
  private debugToolbar: DebugToolbar
  private runMode: 'run' | 'debug' | 'animate-slow' | 'animate-medium' | 'animate-fast' | 'step' = 'run'
  private getBlocksDirty: () => boolean
  /** 見建構參數的 `beforeRun`。⚠️ 可省略——沒有它時行為與從前逐字相同。 */
  private beforeRun?: (tree: SemanticNode) => Promise<void>
  private syncBeforeRun: () => void

  private static readonly ANIMATE_DELAY: Record<string, number> = {
    slow: 800,
    medium: 300,
    fast: 50,
  }

  /**
   * ⚠️ `bus` 是**可選**的，而那不是為了方便——是為了讓這個轉換可以一處一處做。
   *
   * ## 這裡的現況（2026-08-11 量的）
   *
   * ```
   * this.panels.<某個>Panel  在這個檔裡出現   81 次
   * emit('execution:state')  在整個 src/ 裡    0 次
   * ```
   *
   * `SemanticBus` 宣告了 `execution:state`／`execution:output`／`execution:run`，
   * `ViewHost` 宣告了 `onExecutionState`——**而發送端一個都沒接**。
   * 執行器直接持有五個面板的引用。
   *
   * > **一個視圖要能被換掉，發號施令的那一端就不能知道它叫什麼名字。**
   *
   * 那正是「軟體的執行方式與軟體的 UI 攪在一起」的樣子，而硬體視圖進來時
   * 它會擋路——2D 接線圖不該需要 `ExecutionController` 認識它。
   *
   * ## 進度（每一步都讓護欄第三十九條的數字下降）
   *
   * | | 搬了什麼 | 跨層直接呼叫 |
   * |---|---|---|
   * | 2026-08-11 | 變數快照 | 125 |
   * | 2026-08-11 | 狀態與輸出（32 處） | → 95 |
   * | 2026-08-12 | **執行位置**（`execution:at-node`） | → 見基線 |
   *
   * ⚠️ **命令與廣播不是同一種東西**，把它們一起丟上匯流排會做出一個假的解耦。
   * 而「執行到哪個節點」原本被寫成**兩個命令**（高亮積木、捲程式碼），
   * 它其實是**一個廣播的兩個投影**——那是這一步的全部內容。
   *
   * 還沒搬的：`promptInput()`（要回覆，匯流排單向）、`clear()`（重置，不是廣播）。
   */
  constructor(
    panels: ExecutionPanels,
    opts: {
      getBlocksDirty: () => boolean
      syncBeforeRun: () => void
      bus?: SemanticBus
      /**
       * 現在在哪一塊板子上（spec 145）。
       * ⚠️ **每次執行都問一次**——目標會在執行之間被切換，
       * 而一個開機時抓一次的值會讓「切了板子」不生效。
       */
      currentBoard?: () => BoardPinModel | undefined
      formalContext?: (tree: SemanticNode) => SessionOptions['formal']
      /**
       * **開跑之前先問一句**（2026-09-04：預測）——由組裝點注入。
       *
       * 🔴 **執行器不知道有「課程」「題目」「預測」這些東西**：它只知道
       * 「開跑之前有人可能想說話，而那個人會等到說完」。
       *
       * ⚠️ 形狀抄 `pauseForUnrecognized`（「停在這裡，讓人看得到、決定」）
       * ——那條線 2026-08 已經證明過：**要停下來問人的事，
       * 用一個可省略的 async 鉤子，不是把那件事搬進執行器**。
       *
       * 🟢 沒注入的話什麼都不會發生——與加入這個機制之前逐字相同。
       */
      beforeRun?: (tree: SemanticNode) => Promise<void>
    },
  ) {
    this.panels = panels
    this.currentBoard = opts.currentBoard
    this.formalContext = opts.formalContext
    this.beforeRun = opts.beforeRun
    this.getBlocksDirty = opts.getBlocksDirty
    this.syncBeforeRun = opts.syncBeforeRun
    this.bus = opts.bus
    // ⚠️ 收一份「哪些節點有斷點」——**不再跟程式碼視圖要行號**。
    // 翻譯發生在懂「行」的那一端（`monaco-panel.推送斷點`）。
    this.bus?.on('execution:breakpoints', (d) => {
      this.breakpointNodes = new Set(d.nodeIds)
      this.session?.setBreakpoints(this.breakpointNodes)
    })
    // 🔴 **暫停中改一個變數**（2026-08-26）——「調整完狀態才能繼續」的那個「調整」。
    //    ⚠️ 改不到要說。一個按了沒反應的編輯框，比一個唯讀的更糟。
    this.bus?.on('execution:set-variable', (d) => {
      void (async () => {
        const ok = (await this.session?.setVariable(d.name, d.value)) ?? false
        if (!ok) this.broadcastOutput(describeSetVariableRefused(d.name, d.value) + '\n', 'stderr')
      })()
    })
    // 🔴 **暫停中改板子的輸入**（spec 185）——與改變數同一條路：面板不認識執行器，走匯流排
    this.bus?.on('execution:set-input', (d) => {
      void (async () => {
        const r = await this.session?.setInput?.(d.key, d.value)
        if (!r?.ok) this.broadcastOutput(`改不了 ${d.key}：${r?.message ?? '這個執行器不能改板子的輸入'}\n`, 'stderr')
      })()
    })
    this.debugToolbar = new DebugToolbar()
  }


  /**
   * 廣播執行狀態。**不呼叫任何面板。**
   *
   * ⚠️ 在此之前這是 `this.panels.consolePanel?.setStatus(Blockly.Msg[…] || '…', '…')`
   * ——**24 處**，而執行器在替視圖決定文案、i18n 鍵與 CSS class。
   * 現在它只說「狀態是什麼、為什麼」，剩下的是視圖的事。
   *
   * ⚠️ 沒有 bus 時退回直接呼叫：這個類別在測試裡被建構時不一定有匯流排，
   * 而**讓狀態列在某些情境安靜地不更新**比多留一條退路糟得多。
   */
  private broadcastState(e: { status: ExecutionStatus; reason?: ExecutionReason; step?: StepInfo }): void {
    if (this.bus) {
      this.bus.emit('execution:state', e)
      return
    }
    // ⚠️ 退路要涵蓋**每一個實作了這個契約方法的面板**，不只主控台。
    // 第一版只寫了 console，而變數面板的更新就在那條退路上安靜地掉了
    // ——那正是這整輪在治的病：**一條看起來有接的線，其實少接了一個接收者。**
    for (const p of [this.panels.consolePanel, this.panels.variablePanel]) p?.onExecutionState(e)
  }

  /** 廣播這一次到過哪些節點。⚠️ 沒有匯流排時不退路——覆蓋是加分項，不是必需品。 */
  private broadcastCoverage(counts: ReadonlyMap<string, number>, loopCounts: 'entries' | 'checks'): void {
    this.bus?.emit('execution:coverage', {
      visited: [...counts.keys()],
      counts: Object.fromEntries(counts),
      // 迴圈節點的次數算的是什麼——換算圈數要它（spec 205：Cella 與 JS 的定義不同）
      loopCounts,
    })
  }

  /** 廣播輸出。⚠️ `stderr` 由視圖決定怎麼顯示——執行器不知道它會變紅。 */
  private broadcastOutput(text: string, stream: 'stdout' | 'stderr'): void {
    if (this.bus) this.bus.emit('execution:output', { text, stream })
    else if (stream === 'stderr') this.panels.consolePanel?.error(text)
    else this.panels.consolePanel?.write(text)
  }


  /**
   * broadcastState「執行走到了這個節點」。**不呼叫任何面板。**
   *
   * ⚠️ 它取代的是三段逐字相似的程式碼，每一段都長這樣：
   *
   * ```ts
   * const mapping = syncController.getMappingForNode(nodeId)   // { blockId, startLine, endLine }
   * if (mapping.blockId)   blocklyPanel.highlightBlock(...)  + centerOnBlock(...)
   * if (mapping.startLine) monacoPanel.revealLine(...)       + addHighlight(...)
   * ```
   *
   * **執行器同時說了兩遍，因為它知道有兩個視圖。** 而那兩遍說的是同一件事
   * ——「執行到這裡了」。積木高亮一顆積木、程式碼捲到一行、
   * 2D 接線圖讓一顆元件發光，那是**三個投影，不是三個命令**。
   *
   * `nodeId === null` ＝ 清除高亮（原本是 `blocklyPanel?.clearHighlight()`，
   * ⚠️ 而它**只清了積木那一邊**——程式碼那邊的高亮沒被清，
   * 那個不對稱在收攏之前看不出來）。
   */
  private broadcastAtNode(nodeId: string | null, follow: boolean): void {
    if (this.bus) {
      this.bus.emit('execution:at-node', { nodeId, follow })
      return
    }
    for (const p of [this.panels.blocklyPanel, this.panels.codeView]) {
      p?.onExecutionAtNode?.({ nodeId, follow })
    }
  }

  getDebugToolbar(): DebugToolbar {
    return this.debugToolbar
  }

  updatePanels(panels: Partial<ExecutionPanels>): void {
    Object.assign(this.panels, panels)
  }

  setupExecution(): void {
    const replaceBtn = (id: string) => {
      const el = document.getElementById(id)
      if (el) {
        const clone = el.cloneNode(true) as HTMLElement
        el.parentNode?.replaceChild(clone, el)
        return clone
      }
      return null
    }

    replaceBtn('run-btn')?.addEventListener('click', () => this.executeWithCurrentMode())

    const modeBtn = replaceBtn('run-mode-btn')
    const modeMenu = document.getElementById('run-mode-menu')
    modeBtn?.addEventListener('click', (e) => {
      e.stopPropagation()
      if (modeMenu) {
        const visible = modeMenu.style.display !== 'none'
        modeMenu.style.display = visible ? 'none' : ''
        if (!visible) this.updateRunModeMenu()
      }
    })

    modeMenu?.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('.run-mode-option') as HTMLElement | null
      if (!target) return
      const mode = target.dataset.mode as typeof this.runMode
      if (mode) {
        this.runMode = mode
        this.updateRunButtonLabel()
        modeMenu.style.display = 'none'
        this.executeWithCurrentMode()
      }
    })

    document.addEventListener('click', () => {
      if (modeMenu) modeMenu.style.display = 'none'
    })

    this.panels.consolePanel?.onSignal((signal) => {
      if (signal === 'SIGINT' && this.session) this.handleStop()
    })

    this.debugToolbar.onAction((action) => {
      switch (action) {
        // ⚠️ 這是 `DebugAction`（繼續執行），不是元件身分 `lang:continue`
        case 'continue':
          // 🔴 停在「看不懂的東西」上時，`繼續` 的意思是
          //    「我看過狀態了，也改過了，那一行就讓它不執行」——驅動在那個停點收到它
          this.command('continue')
          break
        case 'pause':
          // 自動往下走（動畫、連續單步）→ 下一步停；執行模式跑在 session 裡 → 請它停
          if (this.auto !== null) this.pauseRequested = true
          else this.session?.pause()
          this.debugToolbar.setMode('paused')
          break
        case 'step':
          if (this.session) this.command('step')
          else void this.start('step')
          break
        case 'step-out':
          this.handleStepOut()
          break
        case 'accelerate':
          this.handleAccelerate()
          break
        case 'stop':
          this.handleStop()
          break
      }
    })
  }

  /**
   * **開一次執行**（spec 183）——向登錄表要 `session`，Cella 不接（翻不出來、還沒就緒）就往下找，
   * 而「是誰跑的、前面誰不接、為什麼」都廣播出去（P6：退回要看得見）。
   */
  /**
   * **重播上一次**（vision〈執行的誠實〉的 🆕 那一格）——用上一次打過的那幾行輸入再跑一次。
   * ⚠️ 手動改過的變數、板子的輸入不重播（它們綁在「第幾次停下」上，跑法一變就對不上）——照實說有幾筆沒重播。
   */
  replayLast(): void {
    const lines = this.lastInputs.filter((i): i is Extract<SessionInput, { kind: 'stdin' }> => i.kind === 'stdin').map((i) => i.value)
    const skipped = this.lastInputs.filter((i) => i.kind === 'set-variable' || i.kind === 'set-input').length
    if (this.lastInputs.length === 0) {
      this.broadcastOutput(msg('REPLAY_NOTHING', '上一次沒有從外面拿到任何輸入——直接按執行就好') + '\n', 'stderr')
      return
    }
    void this.start('run', 'medium', lines).then(() => {
      if (skipped > 0) this.broadcastOutput(msg('REPLAY_SKIPPED', '這次重播沒有包含你手動改的 {n} 筆（變數、板子的輸入）').replace('{n}', String(skipped)) + '\n', 'stderr')
    })
  }

  private async start(mode: 'run' | 'debug' | 'step' | 'animate', speed: ExecutionSpeed = 'medium', replay: readonly string[] = []): Promise<void> {
    if (this.getBlocksDirty() && (await this.askSyncBeforeRun())) this.syncBeforeRun()
    const tree = this.panels.syncController?.getCurrentTree()
    if (!tree) return
    if (this.refuseIfBroken(tree)) return
    if (mode === 'run') await this.beforeRun?.(tree)

    this.resetExecution()
    this.mode = mode
    this.auto = mode === 'animate' ? ExecutionController.ANIMATE_DELAY[speed] : null
    this.panels.consolePanel?.clear()
    // 重播：上一次打過的輸入先排進主控台的佇列（它照常回顯、照常被讀——與打字是同一條路）；走匯流排（P9，`principles.md:177`）
    for (const line of replay) this.bus?.emit('execution:input', { text: line })
    // 執行與除錯都是跑到中斷點；單步與動畫停在第一步
    this.panels.bottomPanel?.showTab(mode === 'run' ? 'console' : 'variables')
    this.showExecButtons(true, mode === 'step' ? 'stepping' : 'running')
    this.broadcastState({ status: 'running' })

    const options = { maxSteps: 10_000_000, board: this.currentBoard?.(), formal: this.formalContext?.(tree) }
    const declined: { provider: string; reason: string }[] = []
    const tried = new Set<string>()
    const run = ++this.runId
    const waitedSince = Date.now()
    let announced = false
    for (;;) {
      const opened = openSession(options, tree, tried)
      /**
       * 🟢 **準備中**（spec 205 T003）：JS 直譯器拿掉之後，執行只有 Cella——它還在載入（第一次打開、除錯模組在下載）時
       * 不是「跑不了」，是「等一下」。說一次「準備中」，好了自動開跑；按停止就不等了；等太久照實說。
       */
      if (!opened.session && opened.declined.length > 0 && opened.declined.every((d) => d.pending)) {
        if (!announced) { announced = true; this.broadcastOutput(msg('RUNTIME_PREPARING', '準備中——第一次執行要先載入判斷與執行的模組，好了會自動開始…') + '\n', 'stderr') }
        if (Date.now() - waitedSince > ExecutionController.PREPARE_TIMEOUT_MS) {
          this.broadcastOutput(msg('RUNTIME_PREPARE_TIMEOUT', '執行的模組一直沒有準備好（{why}）——請重新整理頁面再試一次').replace('{why}', opened.declined.map((d) => d.reason).join('；')) + '\n', 'stderr')
          this.broadcastState({ status: 'error' })
          this.showExecButtons(false)
          return
        }
        await new Promise((r) => setTimeout(r, ExecutionController.PREPARE_POLL_MS))
        if (this.runId !== run) return            // 等的時候按了停止、或開了下一次
        continue
      }
      declined.push(...opened.declined)
      if (!opened.session) {
        // 🔴 沒有退路了（spec 205 T008）：照實說為什麼——哪一個寫法 Cella 還不會，並指回那一行（T013 的 nodeId）。
        //    「沒有可用的執行器」只留給真的一個提供者都沒有登記的情況（宿主沒接上）
        const first = opened.declined.find((d) => d.nodeId) ?? opened.declined[0]
        if (first) return this.fail(new SessionStop('runtime', 'RUNTIME_ERR_CELLA_UNSUPPORTED', { why: opened.declined.map((d) => d.reason).join('；') }, first.nodeId ?? null))
        this.broadcastOutput(`沒有可用的執行器（缺：${opened.missing.join('、')}）`, 'stderr')
        this.broadcastState({ status: 'error' })
        this.showExecButtons(false)
        return
      }
      const session = opened.session
      this.session = session
      session.onOutput((text: string) => this.broadcastOutput(text, 'stdout'))
      session.setBreakpoints(this.breakpointNodes)
      const first = await session.launch(tree, { stopOnEntry: mode === 'step' || mode === 'animate' })
      if (this.session !== session) return
      // 開跑時才發現跑不了（一步也沒有執行）⟹ 換下一個，並記下原因（P6：退回要看得見）
      if (first.kind === 'declined') {
        declined.push({ provider: opened.provenance ?? '', reason: first.reason })
        tried.add(opened.provenance ?? '')
        continue
      }
      this.bus?.emit('execution:provenance', { provider: opened.provenance, declined })
      await this.drive(session, Promise.resolve(first))
      return
    }
  }

  /**
   * **一個驅動迴圈**——拿到一個結果，決定下一個指令。
   *
   * 🔴 在此之前是三套（執行、先錄完整條軌跡再重播的單步、動畫），各自掛一個「每一步回呼」。
   *    介面換成 DAP 的形狀之後（宿主下指令），三種模式只差在「停下來之後誰決定下一步」：
   *
   * ```
   * 執行     continue 到中斷點；停了等使用者
   * 單步     stepIn 一次；停了等使用者（「繼續」＝照速度自動往下走）
   * 動畫     stepIn 一次、等一下、再 stepIn——碰到中斷點或「暫停」就等使用者
   * ```
   */
  private async drive(session: ExecutionSession, first: Promise<Outcome>): Promise<void> {
    let outcome = await first
    try {
      for (;;) {
        if (this.session !== session) return            // 停止了，或已經開了下一次
        if (outcome.kind === 'ended') return this.finish(session)
        if (outcome.kind === 'failed') return this.fail(outcome.error)
        if (outcome.kind === 'declined') return this.fail(new SessionStop('runtime', 'RUNTIME_ERR_FALLBACK', {}))
        const stop = outcome.stop

        if (stop.reason === 'awaiting-input') {
          // 等輸入時一定跟著看——使用者正要打字，得知道停在哪
          this.panels.bottomPanel?.showTab('console')
          this.broadcastState({ status: 'running', reason: 'awaiting-input' })
          this.broadcastAtNode(stop.nodeId, true)
          const line = await this.panels.consolePanel!.promptInput()
          if (this.session !== session) return
          outcome = await (line === '\x04' ? session.closeInput() : session.supplyInput(line))
          continue
        }

        if (stop.reason === 'unknown-component') {
          const component = stop.detail?.component ?? ''
          this.broadcastOutput(describeUnknownPause(component) + '\n', 'stderr')
          this.showStop(session, stop, 'unknown-component')
          const next = await this.waitForCommand()
          if (this.session !== session) return
          if (next === 'continue' || next === 'step') this.broadcastOutput(describeUnknownContinued(component) + '\n', 'stderr')
          outcome = await this.issue(session, next)
          continue
        }

        // 加速／跳出：還在要跳過的那一群裡就直接往下走
        if (this.skipIds && stop.nodeId && this.skipIds.has(stop.nodeId)) { outcome = await session.stepIn(); continue }
        this.skipIds = null

        // 自動往下走（動畫、單步模式按了「繼續」）時，中斷點要由這裡認——session 在 stepIn 時回的原因是 step
        const atBreakpoint = stop.reason === 'breakpoint' || (stop.nodeId !== null && this.breakpointNodes.has(stop.nodeId) && this.auto !== null)
        if (this.auto !== null && !atBreakpoint && !this.pauseRequested && stop.reason !== 'pause') {
          this.showStop(session, stop)
          if (this.auto > 0) await new Promise((r) => setTimeout(r, this.auto ?? 0))
          if (this.session !== session) return
          if (this.auto !== null && !this.pauseRequested) { outcome = await session.stepIn(); continue }
        }

        // 停下來等使用者
        this.pauseRequested = false
        this.auto = null
        this.showStop(session, stop, atBreakpoint ? 'breakpoint' : undefined)
        const next = await this.waitForCommand()
        if (this.session !== session) return
        outcome = await this.issue(session, next)
      }
    } finally {
      if (this.session === session && outcome.kind !== 'stopped') this.session = null
    }
  }

  /** 停下的那一刻：哪一塊亮、變數面板有什麼、工具列是什麼樣子（`experience`〈一個「暫停」如果沒有把狀態一起帶出來〉）。 */
  private showStop(session: ExecutionSession, stop: Stop, reason?: ExecutionReason): void {
    const step: StepInfo = { node: null as never, nodeId: stop.nodeId ?? '', sourceRange: null, outputLength: 0, scopeSnapshot: session.variables() }
    this.broadcastState({ status: 'paused', ...(reason ? { reason } : {}), step })
    this.broadcastAtNode(stop.nodeId, this.debugToolbar.isAutoScrollEnabled() ?? false)
    this.currentNodeId = stop.nodeId
    // 板子當下的狀態（spec 185）——硬體分頁在暫停時畫它；給不出來（不是板子、或提供者沒有）就是 null
    this.bus?.emit('execution:environment', { state: session.environment(), paused: true, canSetInput: typeof session.setInput === 'function' })
    if (this.auto === null) {
      this.debugToolbar.show('paused')
      this.panels.bottomPanel?.showTab('variables')
    }
  }

  private waitForCommand(): Promise<'step' | 'continue' | 'stop'> {
    return new Promise((resolve) => { this.commandResolve = resolve })
  }

  /** 使用者的指令 → session 的指令。單步／動畫模式的「繼續」是照速度自動往下走，執行模式是跑到下一個中斷點。 */
  private issue(session: ExecutionSession, cmd: 'step' | 'continue' | 'stop'): Promise<Outcome> {
    if (cmd === 'stop') { session.terminate(); return session.continue() }
    this.debugToolbar.setMode('running')
    this.broadcastState({ status: 'running' })
    if (cmd === 'step') return session.stepIn()
    if (this.mode === 'run' || this.mode === 'debug') return session.continue()
    this.auto = this.mode === 'animate' ? (this.lastAnimateDelay ?? 300) : (ExecutionController.ANIMATE_DELAY[this.stepSpeed()] ?? 0)
    return session.stepIn()
  }

  private stepSpeed(): ExecutionSpeed {
    const v = (document.getElementById('speed-select') as HTMLSelectElement | null)?.value
    return v === 'slow' || v === 'fast' || v === 'instant' ? v as ExecutionSpeed : 'medium'
  }

  private command(cmd: 'step' | 'continue' | 'stop'): void {
    const r = this.commandResolve
    this.commandResolve = null
    if (r) r(cmd)
  }

  private finish(session: ExecutionSession): void {
    this.lastInputs = session.recordedInputs()
    this.clearHighlights()
    this.bus?.emit('execution:environment', { state: null, paused: false, canSetInput: false })
    this.reportInterventions(session)
    const counts = session.coverage()
    if (counts) this.broadcastCoverage(counts, session.loopCounts ?? 'entries')
    // 給不出覆蓋資料 ⟹ 說出來，不留一片「好像全部都跑到了」的空白（spec 183 R2）
    else this.bus?.emit('execution:coverage-missing', {})
    this.broadcastState({ status: 'completed' })
    if (this.mode === 'run') showToast(Blockly.Msg['TOAST_EXEC_COMPLETE'] || 'Program completed', 'success')
    this.session = null
    this.showExecButtons(false)
  }

  private fail(e: SessionStop): void {
    if (this.session && e.kind !== 'aborted') this.lastInputs = this.session.recordedInputs()
    this.clearHighlights()
    this.bus?.emit('execution:environment', { state: null, paused: false, canSetInput: false })
    if (e.kind === 'aborted') {
      this.broadcastState({ status: 'idle', reason: 'aborted' })
    } else {
      this.broadcastOutput(describeRuntimeStop(e.i18nKey, e.params), 'stderr')
      if (e.nodeId) this.broadcastAtNode(e.nodeId, true)
      this.broadcastState({ status: 'error' })
      if (this.mode === 'run') showToast(Blockly.Msg['TOAST_EXEC_ERROR'] || 'Execution error', 'error')
    }
    this.session = null
    this.showExecButtons(false)
  }

  private handleStepOut(): void {
    // 「跳過這一顆的重複」：還停在同一顆時繼續往下（迴圈裡同一句的下一次）
    if (!this.session || !this.currentNodeId) return this.command('step')
    this.skipIds = new Set([this.currentNodeId])
    this.command('step')
  }

  private handleAccelerate(): void {
    if (!this.session || !this.currentNodeId) return
    const level = this.debugToolbar.getAccelerateLevel() ?? 1
    this.skipIds = new Set(level <= 1 ? [this.currentNodeId] : this.panels.blocklyPanel?.nodesInAncestorScope(this.currentNodeId, level) ?? [this.currentNodeId])
    if (this.commandResolve) this.command('step')
  }

  handleStop(): void {
    this.bus?.emit('execution:environment', { state: null, paused: false, canSetInput: false })
    this.bus?.emit('execution:input-cancel', {})
    const s = this.session
    this.session = null
    s?.terminate()
    this.command('stop')
    this.clearHighlights()
    this.panels.variablePanel?.clear()
    this.broadcastState({ status: 'idle' })
    this.showExecButtons(false)
  }

  private resetExecution(): void {
    this.runId++                                   // 「準備中」那個等待迴圈看得到：不等了
    this.bus?.emit('execution:input-cancel', {})
    const s = this.session
    this.session = null
    s?.terminate()
    this.command('stop')
    this.auto = null
    this.skipIds = null
    this.pauseRequested = false
    this.currentNodeId = null
    this.clearHighlights()
  }

  private showExecButtons(running: boolean, mode: 'running' | 'stepping' = 'running'): void {
    const runGroup = document.querySelector('.run-group') as HTMLElement | null
    if (runGroup) runGroup.style.display = running ? 'none' : ''

    if (running) {
      this.debugToolbar.show(mode)
    } else {
      this.debugToolbar.hide()
    }
  }

  /**
   * 宿主那側按了執行（分頁標題列的 ▷ 或它的下拉）。
   *
   * 🔴 **走的是同一支執行**——帶模式時只是先切模式，
   * 不新開一條「宿主專用的執行路徑」。
   */
  runFromHost(mode?: string): void {
    if (mode && RUN_MODES.some((m) => m.id === mode)) {
      this.runMode = mode as typeof this.runMode
      // ⚠️ 面板裡那顆按鈕在這個宿主不存在——那支函式本來就有守衛。
      this.updateRunButtonLabel()
    }
    this.executeWithCurrentMode()
  }

  private executeWithCurrentMode(): void {
    switch (this.runMode) {
      case 'run':
        void this.start('run')
        break
      case 'debug':
        // 除錯＝跑到中斷點，停下時看變數（沒有中斷點就跑完）
        if (this.session && this.commandResolve) this.command('continue')
        else void this.start('debug')
        break
      case 'step':
        // 已經停著 ⟹ 走一步；否則開一次、停在第一步
        if (this.session && this.commandResolve) this.command('step')
        else void this.start('step')
        break
      case 'animate-slow':
      case 'animate-medium':
      case 'animate-fast': {
        const speed = ({ 'animate-slow': 'slow', 'animate-medium': 'medium', 'animate-fast': 'fast' } as const)[this.runMode]
        this.lastAnimateDelay = ExecutionController.ANIMATE_DELAY[speed]
        // 動畫停著 ⟹ 照新速度繼續走
        if (this.session && this.commandResolve && this.mode === 'animate') this.command('continue')
        else void this.start('animate', speed)
        break
      }
    }
  }


  private updateRunButtonLabel(): void {
    const btn = document.getElementById('run-btn')
    if (!btn) return
    const labels: Record<string, string> = Object.fromEntries(RUN_MODES.map((m) => [m.id, m.label]))
    btn.textContent = labels[this.runMode] ?? '▶ 執行'
  }

  private updateRunModeMenu(): void {
    const menu = document.getElementById('run-mode-menu')
    if (!menu) return
    menu.querySelectorAll('.run-mode-option').forEach(el => {
      const opt = el as HTMLElement
      opt.classList.toggle('active', opt.dataset.mode === this.runMode)
    })
  }

  /** ⚠️ 原本只清積木那一邊，改成廣播之後**兩個視圖都會清**——見 `broadcastAtNode` 的註解。 */
  /**
   * **語法錯誤的程式不該跑得起來。**
   *
   * ⚠️ **閘門在這一層，不在直譯器裡**，而那是刻意的：
   *
   * ```
   * ExecutionController  知道【使用者按了執行】   → 閘門在這裡
   * Interpreter          只知道有人給了它一棵樹   → 不在這裡
   * ```
   *
   * 兩個理由：① 要求的是**時機**（按執行才判，編輯中的程式大部分時間都不合法）；
   * ② **既有測試直接呼叫 `interpreter.run(tree)`**，放那一層會擋掉一大片
   * 與本功能無關的測試。
   *
   * ## ✅ 而辨識層 2026-08-14（spec `121`）補齊了
   *
   * `120` 當時四種寫錯的程式只有兩種有標記。`121` 補上解析器的傳播旗標之後
   * 三種漏分號 ＋ 少右大括號全部擋得住，而**這個閘門一行沒改**。
   *
   * ⚠️ 限定換了範圍沒有消失：**認得的是解析器認得的**。
   *
   * ⚠️ 而 `unsupported`（我們還不認得的寫法）**必須放行**：那是我們的問題，
   * 程式本身是對的。判準沿用 `canExecute`，**不在這裡另立一份**。
   *
   * @returns 有沒有被擋下來
   */
  /**
   * **跑到一個看不懂的東西——停在那裡，讓人看得到、改得動，然後決定。**
   *
   * 使用者 2026-08-26 逐字：
   * 「這不能直接跑，而是跑到那邊**要有斷點**，讓使用者**調整完狀態**才能繼續跑下去，
   *  或是**直接停止**」。
   *
   * ## 它與斷點走同一條路，而理由不同
   *
   * ```
   * 斷點            使用者自己放的     reason: 'breakpoint'
   * 看不懂的東西     系統自己撞到的     reason: 'unknown-component'   ← 這一支
   * ```
   *
   * 兩者的暫停機構是同一套（`animateResolve` 那條），**刻意不新做一套**——
   * 新做一套的代價是「繼續」與「停止」要維護兩份，而它們遲早會不一樣。
   *
   * ## ⚠️ 這裡做的四件事，少一件這個暫停就沒有意義
   *
   * ```
   * ① 說出是什麼            主控台一行，指名那顆元件
   * ② 指到那一顆            broadcastAtNode —— 「哪裡不行」是學生要的答案
   * ③ 打開變數面板          沒有狀態可看的話，「調整完狀態」是一句空話
   * ④ 等一個【明確的】決定   而不是預設繼續
   * ```
   */
  /**
   * **這次執行有沒有人插手過——有的話說出來。**
   *
   * `principles.md:135` 逐字：「降級必須單調遞減、**必須可見**」。
   * 一個手填過變數的執行，它的輸出**不是這支程式單獨產生的**
   * ——而畫面上如果不說，那個結果會被當成程式的結果。
   *
   * ⚠️ **刻意不問任何問題**，只陳述。昨天剛學到的：
   * 「別新增一個問句——『要不要繼續？』正是前一刀拿掉的東西。」
   *
   * 🪦 而「**重播上一次**」today 還沒有一個按鈕：引擎那一半做完了
   * （`setReplayInputs`，第七十六條護欄在守），而**觸發它的動作是新的 UI**，
   * 那是另一刀。這裡先讓那份紀錄**看得見**。
   */
  private reportInterventions(session: ExecutionSession): void {
    const inputs = session.recordedInputs()
    const edits = inputs.filter((i) => i.kind === 'set-variable' || i.kind === 'set-input').length
    if (edits === 0) return
    this.broadcastOutput(describeInterventions(edits) + '\n', 'stderr')
  }

  /**
   * **積木改過了，要先同步嗎**——頁內的問句，不是 `window.confirm`。
   *
   * ## 為什麼換掉（2026-08-26，第七十七條護欄）
   *
   * `ui/prompt-dialog.ts:4` 為 `window.prompt` 做過同一件事，
   * 而 `ui/toolbar/style-action-bar.ts:3` 逐字寫著它
   * 「**Replaces confirm() dialogs**」——**兩次替換都做了，而這裡還有三處**。
   *
   * 用得上的理由只有**已驗證的那一半**：`confirm()` **凍住整個頁面**，
   * 自動化工具也一起凍住。🔴 而 e2e 對這三處**零覆蓋**——那不是巧合：
   * **一個會凍住 Playwright 的東西，測試寫不下去。**
   *
   * ⚠️ **沒拿來當理由的那一半**：它在 VSCode 的 webview 裡會不會「點了沒反應」。
   * `prompt-dialog.ts` 的那個證據是關於 `window.prompt`，**不是 `confirm`**，
   * 而我沒有驗過。**沒驗過的前提不拿來推事情。**
   *
   * ## ⚠️ 這一刀【只換載體】，答案的語義一個字都沒改
   *
   * ```
   * 今天的 confirm   確定 → 先同步再跑    取消 → 【就跑現在這一份】
   * 換完的 QuickPick 一樣                Esc  → 【就跑現在這一份】（照舊）
   * ```
   *
   * 🟡 **而「Esc 等於照舊跑下去」是一個可以再談的設計**：從一個選單逃出來，
   * 多數人期待的是「什麼都不要發生」。**這一刀刻意不動它**——換載體的那一刀
   * 如果順手改了語義，紅了就無法歸因。留在這裡當一個看得見的問句。
   */
  private askSyncBeforeRun(): Promise<boolean> {
    return new Promise((resolve) => {
      showQuickPick(
        {
          title: msg('EXEC_UNSYNC_PROMPT', '積木改過了，要先同步再執行嗎？'),
          items: [
            { value: 'sync', label: msg('EXEC_UNSYNC_SYNC', '⟳ 先同步再執行') },
            { value: 'as-is', label: msg('EXEC_UNSYNC_AS_IS', '▶ 就跑現在這一份') },
          ],
        },
        (picked) => resolve(picked?.[0] === 'sync'),
      )
    })
  }

  private refuseIfBroken(tree: unknown): boolean {
    const verdict = canExecute(tree as SemanticNode)
    if (verdict.ok) return false
    // `history/017`：一道會拒絕的檢查必須同時回答「被拒絕的東西去哪了」。
    const msg = describeExecutionRefusal(verdict.nodeIds.length, verdict.cause)
    this.broadcastOutput(msg + '\n', 'stderr')
    this.panels.bottomPanel?.showTab('console')
    showToast(msg, 'error')
    this.broadcastState({ status: 'idle', reason: 'refused' })
    return true
  }

  private clearHighlights(): void {
    this.broadcastAtNode(null, false)
  }

  /**
   * 下方面板**晚一點才建**時換上新的那一份。
   *
   * ⚠️ 這在「宿主打不開終端機、主控台還給面板」時會發生
   *（2026-08-25，Arduino IDE）。不換的話 `showTab` 打在 `null` 上，
   * **而輸出看起來像沒有跑**。
   */
  attachBottomPanel(panel: BottomPanel): void {
    this.panels.bottomPanel = panel
  }

  dispose(): void {
    this.debugToolbar.dispose()
  }
}
