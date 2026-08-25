import { RUN_MODES } from '../core/host/controls'
import * as Blockly from 'blockly'
import type { BoardPinModel } from '../core/types'
import { SemanticInterpreter } from '../interpreter/interpreter'
import { StepController } from '../core/step-controller'
import { DebugToolbar } from './debug-toolbar'
import type { StepInfo, ExecutionSpeed } from '../interpreter/types'
import type { SemanticNode as InterpreterNode } from '../core/types'
import { RuntimeError } from '../interpreter/errors'
import { showToast } from './toolbar/toast'
import type { BlocklyPanel } from './panels/blockly-panel'
import type { CodeView } from '../core/host/code-view'
import type { ConsolePanel } from './panels/console-panel'
import { canExecute } from '../core/diagnostics'
import { describeExecutionRefusal } from '../core/refusal-message'
// 🔴 **不得直接推 `e.message`**——那是給開發者看的湊合字串（身分 ＋ JSON）。
// 三個顯示點各查一次表就是三個會忘記的地方，所以收成一個具名函式，
// 而第四十四條護欄的第二支測試正是「不得有人繞過它」。
import { describeRuntimeStop } from './runtime-message'
import type { SemanticNode } from '../core/types'
import type { VariablePanel } from './panels/variable-panel'
import type { BottomPanel } from './layout/bottom-panel'
import type { SyncController } from '../core/sync-controller'
import type { SemanticBus } from '../core/semantic-bus'
import type { ExecutionReason } from '../core/view-host'
import type { ExecutionStatus } from '../interpreter/types'

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
  private interpreter: SemanticInterpreter | null = null
  private stepController: StepController | null = null
  private currentBoard?: () => BoardPinModel | undefined
  private debugToolbar: DebugToolbar
  private runMode: 'run' | 'debug' | 'animate-slow' | 'animate-medium' | 'animate-fast' | 'step' = 'run'
  private stepRecords: StepInfo[] = []
  private currentStepIndex = -1
  private animatePaused = false
  private animateResolve: (() => void) | null = null
  private animateSpeed: ExecutionSpeed = 'medium'
  private animateAccelerateSkipIds: Set<string> | null = null
  private getBlocksDirty: () => boolean
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
    },
  ) {
    this.panels = panels
    this.currentBoard = opts.currentBoard
    this.getBlocksDirty = opts.getBlocksDirty
    this.syncBeforeRun = opts.syncBeforeRun
    this.bus = opts.bus
    // ⚠️ 收一份「哪些節點有斷點」——**不再跟程式碼視圖要行號**。
    // 翻譯發生在懂「行」的那一端（`monaco-panel.推送斷點`）。
    this.bus?.on('execution:breakpoints', (d) => {
      this.breakpointNodes = new Set(d.nodeIds)
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
      if (signal === 'SIGINT') {
        this.interpreter?.abort()
        if (this.stepController?.getStatus() === 'stepping' || this.stepController?.getStatus() === 'paused') {
          this.handleStop()
        }
      }
    })

    this.debugToolbar.onAction((action) => {
      switch (action) {
        // ⚠️ 這是 `DebugAction`（繼續執行），不是元件身分 `lang:continue`
        case 'continue':
          if (this.animatePaused && this.animateResolve) {
            this.animatePaused = false
            this.debugToolbar.setMode('running')
            this.broadcastState({ status: 'running' })
            this.animateResolve()
          } else if (this.stepController) {
            this.stepController.resume()
            this.debugToolbar.setMode('running')
            this.broadcastState({ status: 'running' })
          }
          // If interpreter is running but no animateResolve (e.g., waiting for input), ignore
          break
        case 'pause':
          if (this.animateResolve === null && this.interpreter) {
            this.animatePaused = true
          } else {
            this.handlePause()
          }
          this.debugToolbar.setMode('paused')
          break
        case 'step':
          if (this.animatePaused && this.animateResolve) {
            this.animatePaused = true
            this.animateResolve()
          } else if (!this.interpreter) {
            // Only start new step execution if no interpreter is already running
            this.handleStep()
          }
          // If interpreter is running but no animateResolve (e.g., waiting for input), ignore
          break
        case 'step-out':
          this.handleStepOut()
          break
        case 'accelerate':
          this.handleAccelerate()
          break
        case 'stop':
          if (this.animateResolve) {
            const resolve = this.animateResolve
            this.animateResolve = null
            resolve()
          }
          this.interpreter?.abort()
          this.handleStop()
          break
      }
    })
  }

  private async handleRun(): Promise<void> {
    if (this.getBlocksDirty()) {
      const sync = confirm(Blockly.Msg['EXEC_UNSYNC_PROMPT'] || 'Blocks have changed. Sync before running?')
      if (sync) this.syncBeforeRun()
    }

    // Execution is a projection of the canonical semantic tree — not biased to any view
    const tree = this.panels.syncController?.getCurrentTree()
    if (!tree) return
    if (this.refuseIfBroken(tree)) return

    this.resetExecution()
    this.interpreter = new SemanticInterpreter({ maxSteps: 10_000_000, board: this.currentBoard?.() })
    this.interpreter.setUnknownComponentHandler(async (component: string) => {
      const msg = Blockly.Msg['EXEC_UNKNOWN_COMPONENT_PROMPT']
        ? Blockly.Msg['EXEC_UNKNOWN_COMPONENT_PROMPT'].replace('%1', component)
        : `Unknown component "${component}" encountered.\nClick OK to skip it and continue, or Cancel to stop execution.`
      const skip = confirm(msg)
      return skip ? 'skip' : 'abort'
    })
    this.interpreter.setInputProvider(() => this.panels.consolePanel!.promptInput())
    this.interpreter.setOutputCallback((text: string) => {
      this.broadcastOutput(text, 'stdout')
    })
    this.interpreter.setWaitingCallback((nodeId) => {
      // Switch to console tab so the input field is visible
      this.panels.bottomPanel?.showTab('console')
      this.broadcastState({ status: 'running', reason: 'awaiting-input' })
      // 等待輸入時一定跟著看——使用者正要打字，得知道停在哪。
      this.broadcastAtNode(nodeId, true)
    })

    // Breakpoint support in run mode: pause on breakpoint, then allow stepping
    this.animatePaused = false
    this.animateResolve = null
    this.stepRecords = []
    this.currentStepIndex = -1
    this.interpreter.setRecordSteps(true)
    this.interpreter.setStepRecordCallback(async (step: StepInfo) => {
      this.stepRecords.push(step)
      this.currentStepIndex = this.stepRecords.length - 1

      // If already in stepping mode (user clicked "step" from breakpoint), pause every step
      let shouldPause = this.animatePaused

      // Check breakpoints
      if (!shouldPause && step.nodeId && this.breakpointNodes.has(step.nodeId)) {
        shouldPause = true
        this.broadcastState({ status: 'paused', reason: 'breakpoint' })
      }

      if (shouldPause) {
        this.displayStep(this.currentStepIndex)
        this.animatePaused = true
        this.debugToolbar.setMode('paused')
        this.panels.bottomPanel?.showTab('variables')
        await new Promise<void>(resolve => { this.animateResolve = resolve })
        this.animateResolve = null
      }
    })

    this.showExecButtons(true, 'running')
    this.panels.consolePanel?.clear()
    this.broadcastState({ status: 'running' })
    this.panels.bottomPanel?.showTab('console')

    try {
      await this.interpreter.execute(tree as unknown as InterpreterNode)
      this.clearHighlights()
      this.broadcastState({ status: 'completed' })
      showToast(Blockly.Msg['TOAST_EXEC_COMPLETE'] || 'Program completed', 'success')
    } catch (e) {
      if (e instanceof RuntimeError) {
        if (e.i18nKey === 'RUNTIME_ERR_ABORTED') {
          this.broadcastState({ status: 'idle', reason: 'aborted' })
        } else {
          this.broadcastOutput(describeRuntimeStop(e.i18nKey, e.params), 'stderr')
          this.broadcastState({ status: 'error' })
          showToast(Blockly.Msg['TOAST_EXEC_ERROR'] || 'Execution error', 'error')
        }
      } else {
        this.broadcastOutput(String(e), 'stderr')
        this.broadcastState({ status: 'error' })
      }
    } finally {
      this.showExecButtons(false)
    }
  }

  private async handleStep(): Promise<void> {
    if (this.stepController?.getStatus() === 'stepping' || this.stepController?.getStatus() === 'paused') {
      this.stepController.step()
      return
    }

    if (this.getBlocksDirty()) {
      const sync = confirm(Blockly.Msg['EXEC_UNSYNC_PROMPT'] || 'Blocks have changed. Sync before running?')
      if (sync) this.syncBeforeRun()
    }

    // Execution is a projection of the canonical semantic tree — not biased to any view
    const tree = this.panels.syncController?.getCurrentTree()
    if (!tree) return
    if (this.refuseIfBroken(tree)) return

    this.resetExecution()
    this.interpreter = new SemanticInterpreter({ maxSteps: 10_000_000, board: this.currentBoard?.() })
    this.interpreter.setUnknownComponentHandler(async (component: string) => {
      const msg = Blockly.Msg['EXEC_UNKNOWN_COMPONENT_PROMPT']
        ? Blockly.Msg['EXEC_UNKNOWN_COMPONENT_PROMPT'].replace('%1', component)
        : `Unknown component "${component}" encountered.\nClick OK to skip it and continue, or Cancel to stop execution.`
      const skip = confirm(msg)
      return skip ? 'skip' : 'abort'
    })
    this.interpreter.setInputProvider(() => this.panels.consolePanel!.promptInput())
    this.interpreter.setOutputCallback((text: string) => {
      this.broadcastOutput(text, 'stdout')
    })
    this.interpreter.setWaitingCallback((nodeId) => {
      // Switch to console tab so the input field is visible
      this.panels.bottomPanel?.showTab('console')
      this.broadcastState({ status: 'running', reason: 'awaiting-input' })
      // 等待輸入時一定跟著看——使用者正要打字，得知道停在哪。
      this.broadcastAtNode(nodeId, true)
    })
    this.panels.consolePanel?.clear()
    this.panels.bottomPanel?.showTab('variables')
    this.showExecButtons(true, 'stepping')

    try {
      this.stepRecords = await this.interpreter.executeWithSteps(tree as unknown as InterpreterNode)
    } catch (e) {
      if (e instanceof RuntimeError) {
        this.broadcastOutput(describeRuntimeStop(e.i18nKey, e.params), 'stderr')
        this.broadcastState({ status: 'error' })
        this.showExecButtons(false)
        return
      }
    }

    this.currentStepIndex = -1
    this.stepController = new StepController()

    const speedSelect = document.getElementById('speed-select') as HTMLSelectElement | null
    if (speedSelect) {
      this.stepController.setSpeed(speedSelect.value as ExecutionSpeed)
    }

    this.stepController.setStepFn(() => {
      this.currentStepIndex++
      return this.currentStepIndex < this.stepRecords.length - 1
    })

    this.stepController.onStep(() => {
      this.displayStep(this.currentStepIndex)

      const step = this.stepRecords[this.currentStepIndex]
      if (step?.nodeId) {
        if (this.breakpointNodes.has(step.nodeId) && this.stepController?.getStatus() === 'running') {
          this.stepController.pause()
          this.broadcastState({ status: 'paused', reason: 'breakpoint' })
          this.debugToolbar.setMode('paused')
        }
      }
    })

    this.stepController.onStop(() => {
      this.clearHighlights()
      this.panels.variablePanel?.clear()
      this.showExecButtons(false)
    })

    this.broadcastState({ status: 'running' })
    this.stepController.step()
  }

  private handlePause(): void {
    if (this.stepController?.getStatus() === 'running') {
      this.stepController.pause()
      this.broadcastState({ status: 'paused' })
      this.debugToolbar.setMode('paused')
    }
  }

  private handleStepOut(): void {
    if (!this.stepController || !this.stepRecords.length) return
    const status = this.stepController.getStatus()
    if (status !== 'stepping' && status !== 'paused') return

    const currentNodeId = this.stepRecords[this.currentStepIndex]?.nodeId
    if (!currentNodeId) {
      this.stepController.step()
      return
    }

    while (this.currentStepIndex < this.stepRecords.length - 1) {
      const nextStep = this.stepRecords[this.currentStepIndex + 1]
      if (nextStep?.nodeId !== currentNodeId) break
      this.currentStepIndex++
    }
    this.stepController.step()
  }

  private handleAccelerate(): void {
    const currentNodeId = this.stepRecords[this.currentStepIndex]?.nodeId
    if (!currentNodeId) return
    if (this.interpreter && !this.stepController) {
      const level = this.debugToolbar.getAccelerateLevel() ?? 1
      // ⚠️ 這一句取代了四步積木 API（`getBlockById`／`getSurroundParent`／
      // `getChildren`／`getBlockMappings`）。執行器問的是一個**語義問題**
      // ——「跳過哪些節點」——而它原本得走進積木的座標系才問得出來。
      const skip = this.panels.blocklyPanel?.nodesInAncestorScope(currentNodeId, level) ?? [currentNodeId]
      this.animateAccelerateSkipIds = new Set(skip)

      if (this.animatePaused && this.animateResolve) {
        this.animatePaused = false
        this.debugToolbar.setMode('running')
        this.animateResolve()
      }
      return
    }

    if (!this.stepController || !this.stepRecords.length) return
    const status = this.stepController.getStatus()
    if (status === 'completed' || status === 'idle') return

    const wasRunning = status === 'running'
    if (wasRunning) this.stepController.pause()

    const level = this.debugToolbar.getAccelerateLevel() ?? 1

    if (level <= 1) {
      while (this.currentStepIndex < this.stepRecords.length - 1) {
        const nextStep = this.stepRecords[this.currentStepIndex + 1]
        if (nextStep?.nodeId !== currentNodeId) break
        this.currentStepIndex++
      }
    } else {
      // ⚠️ 這是上面那段的**第二份逐字拷貝**（動畫路徑一份、逐步路徑一份）。
      // 兩份一起換掉——而它們是同一段積木知識，換完之後這裡不再有第二份。
      const skipNodeIds = new Set(this.panels.blocklyPanel?.nodesInAncestorScope(currentNodeId, level) ?? [])
      while (this.currentStepIndex < this.stepRecords.length - 1) {
        const nextStep = this.stepRecords[this.currentStepIndex + 1]
        if (!nextStep?.nodeId || !skipNodeIds.has(nextStep.nodeId)) break
        this.currentStepIndex++
      }
    }
    this.displayStep(this.currentStepIndex)
    if (wasRunning) {
      this.stepController.resume()
    } else {
      this.stepController.step()
    }
  }

  handleStop(): void {
    this.stepController?.stop()
    this.clearHighlights()
    this.panels.variablePanel?.clear()
    this.broadcastState({ status: 'idle' })
    this.showExecButtons(false)
  }

  private displayStep(index: number): void {
    if (index < 0 || index >= this.stepRecords.length) return
    const step = this.stepRecords[index]

    // broadcastState，不是命令——誰想看變數，自己登錄成視圖（`core/view-registry.ts`）。
    // ⚠️ 沒有 bus 時退回直接呼叫：這個類別在測試裡被建構時不一定有匯流排，
    // 而**讓變數面板在某些情境安靜地不更新**比多留一行退路糟得多。
    this.broadcastState({ status: 'paused', step })
    this.panels.bottomPanel?.showTab('variables')

    this.broadcastAtNode(step.nodeId ?? null, this.debugToolbar.isAutoScrollEnabled() ?? false)

    if (this.stepController?.getStatus() === 'completed') {
      this.broadcastState({ status: 'completed' })
      this.showExecButtons(false)
    }
  }

  private resetExecution(): void {
    this.interpreter = null
    this.stepController?.stop()
    this.stepController = null
    this.stepRecords = []
    this.currentStepIndex = -1
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
        this.handleRun()
        break
      case 'debug':
      case 'step':
        this.handleStep()
        break
      case 'animate-slow':
      case 'animate-medium':
      case 'animate-fast': {
        const speedMap = { 'animate-slow': 'slow', 'animate-medium': 'medium', 'animate-fast': 'fast' } as const
        this.handleAnimate(speedMap[this.runMode])
        break
      }
    }
  }

  private async handleAnimate(speed: ExecutionSpeed): Promise<void> {
    if (this.animatePaused && this.animateResolve) {
      this.animatePaused = false
      this.animateSpeed = speed
      this.debugToolbar.setMode('running')
      this.broadcastState({ status: 'running' })
      this.animateResolve()
      return
    }

    if (this.getBlocksDirty()) {
      const sync = confirm(Blockly.Msg['EXEC_UNSYNC_PROMPT'] || 'Blocks have changed. Sync before running?')
      if (sync) this.syncBeforeRun()
    }

    // Execution is a projection of the canonical semantic tree — not biased to any view
    const tree = this.panels.syncController?.getCurrentTree()
    if (!tree) return
    if (this.refuseIfBroken(tree)) return

    this.resetExecution()
    this.animatePaused = false
    this.animateResolve = null
    this.animateSpeed = speed
    this.animateAccelerateSkipIds = null

    this.interpreter = new SemanticInterpreter({ maxSteps: 10_000_000, board: this.currentBoard?.() })
    this.interpreter.setUnknownComponentHandler(async (component: string) => {
      const msg = Blockly.Msg['EXEC_UNKNOWN_COMPONENT_PROMPT']
        ? Blockly.Msg['EXEC_UNKNOWN_COMPONENT_PROMPT'].replace('%1', component)
        : `Unknown component "${component}" encountered.\nClick OK to skip it and continue, or Cancel to stop execution.`
      const skip = confirm(msg)
      return skip ? 'skip' : 'abort'
    })
    this.interpreter.setInputProvider(() => this.panels.consolePanel!.promptInput())
    this.interpreter.setOutputCallback((text: string) => {
      this.broadcastOutput(text, 'stdout')
    })
    this.interpreter.setWaitingCallback((nodeId) => {
      // Switch to console tab so the input field is visible
      this.panels.bottomPanel?.showTab('console')
      this.broadcastState({ status: 'running', reason: 'awaiting-input' })
      // 等待輸入時一定跟著看——使用者正要打字，得知道停在哪。
      this.broadcastAtNode(nodeId, true)
    })

    this.stepRecords = []
    this.currentStepIndex = -1
    this.interpreter.setRecordSteps(true)
    this.interpreter.setStepRecordCallback(async (step: StepInfo) => {
      this.stepRecords.push(step)
      this.currentStepIndex = this.stepRecords.length - 1

      if (this.animateAccelerateSkipIds && step.nodeId && this.animateAccelerateSkipIds.has(step.nodeId)) {
        return
      }
      this.animateAccelerateSkipIds = null

      this.displayStep(this.currentStepIndex)

      let shouldPause = this.animatePaused
      if (!shouldPause && step.nodeId) {
        if (this.breakpointNodes.has(step.nodeId)) {
          shouldPause = true
          this.broadcastState({ status: 'paused', reason: 'breakpoint' })
        }
      }

      if (shouldPause) {
        this.animatePaused = true
        this.debugToolbar.setMode('paused')
        await new Promise<void>(resolve => { this.animateResolve = resolve })
        this.animateResolve = null
        return
      }

      const delay = ExecutionController.ANIMATE_DELAY[this.animateSpeed]
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    })

    this.panels.consolePanel?.clear()
    this.panels.bottomPanel?.showTab('variables')
    this.showExecButtons(true, 'running')
    this.broadcastState({ status: 'running' })

    try {
      await this.interpreter.execute(tree as unknown as InterpreterNode)
      this.broadcastState({ status: 'completed' })
    } catch (e) {
      if (e instanceof RuntimeError) {
        if (e.i18nKey === 'RUNTIME_ERR_ABORTED') {
          this.broadcastState({ status: 'idle', reason: 'aborted' })
        } else {
          this.broadcastOutput(describeRuntimeStop(e.i18nKey, e.params), 'stderr')
          this.broadcastState({ status: 'error' })
        }
      } else {
        this.broadcastOutput(String(e), 'stderr')
        this.broadcastState({ status: 'error' })
      }
    } finally {
      this.clearHighlights()
      this.showExecButtons(false)
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
   * ② **既有測試直接呼叫 `interpreter.execute(tree)`**，放那一層會擋掉一大片
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
  private refuseIfBroken(tree: unknown): boolean {
    const verdict = canExecute(tree as SemanticNode)
    if (verdict.ok) return false
    // `history/017`：一道會拒絕的檢查必須同時回答「被拒絕的東西去哪了」。
    const msg = describeExecutionRefusal(verdict.nodeIds.length)
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
