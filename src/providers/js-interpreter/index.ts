/**
 * **第一個提供者：今天的 JS 直譯器**（spec 179，重構階段 1；spec 183 換成 DAP 的形狀）。
 *
 * 只宣告它真的有的能力——執行與除錯、步數。**不宣告判決與型別查詢**：
 * 它沒有這兩種能力，假裝有（例如把「跑完沒出錯」當 accept）就違反 P6 誠實降級。
 *
 * ## 回呼模型 → 宿主下指令（spec 183 R1）
 *
 * 直譯器每走一步之前回呼一次（`setBeforeStepCallback`）。這裡在回呼裡判斷該不該停（單步、中斷點），
 * 要停就把 `stopped` 交給**目前那個指令**的結果，然後在回呼裡等下一個指令。
 * 讀輸入、跑到認不得的東西，也是同一招：交出 `stopped`，等宿主給輸入或決定繼續。
 * 這一套原本在控制器裡（`animateResolve`）——控制器不該知道是誰在跑、怎麼停。
 *
 * 🪦 **重構階段 6（切換到 Cella 那天）整個目錄刪掉**，連同 `src/interpreter/` 與各元件的 `execute.ts`。
 * 核心與介面不 import 這裡（`audit-layering` 守著），所以刪它不必動核心。
 */
import { SemanticInterpreter } from '../../interpreter/interpreter'
import { RuntimeError } from '../../interpreter/errors'
import { SessionStop, type ExecutionSession, type Outcome, type Provider, type SessionOptions, type Stop } from '../../core/capabilities'

/** 直譯器的停止 → 核心的停止。控制器只認 `SessionStop`。 */
function normalize(e: unknown): SessionStop {
  if (e instanceof SessionStop) return e
  if (e instanceof RuntimeError) {
    return new SessionStop(e.i18nKey === 'RUNTIME_ERR_ABORTED' ? 'aborted' : 'runtime', e.i18nKey, e.params, e.nodeId)
  }
  return new SessionStop('runtime', 'RUNTIME_ERR_INTERNAL', { message: String(e) })
}

class JsSession implements ExecutionSession {
  private readonly it: SemanticInterpreter
  private breakpoints = new Set<string>()
  private stepping = false
  private pausing = false
  /** 目前那個指令在等的結果。 */
  private pending: ((o: Outcome) => void) | null = null
  /** 停著時，讓直譯器繼續的那一把鑰匙（單步／中斷點／認不得的東西各一種）。 */
  private resume: (() => void) | null = null
  private inputResolve: ((line: string) => void) | null = null
  private unknownResolve: ((d: 'continue' | 'stop') => void) | null = null
  private waitingNode: string | null = null
  private ended = false
  /** 結果在指令下之前就出現了（例如第一步就要輸入）——先存著，下一個指令直接拿。 */
  private early: Outcome | null = null

  constructor(options: SessionOptions) {
    this.it = new SemanticInterpreter({ maxSteps: options.maxSteps, board: options.board })
    // 停在【即將執行】的那一顆（DAP 的慣例，與 Cella 一致）
    this.it.setBeforeStepCallback(async (nodeId) => {
      const hit = this.breakpoints.has(nodeId)
      if (this.pausing) { this.pausing = false; await this.stop({ reason: 'pause', nodeId }); return }
      if (!this.stepping && !hit) return
      await this.stop({ reason: this.stepping ? 'step' : 'breakpoint', nodeId })
    })
    this.it.setWaitingCallback((nodeId) => { this.waitingNode = nodeId })
    this.it.setInputProvider(() => new Promise<string>((resolve) => {
      this.inputResolve = resolve
      this.deliver({ kind: 'stopped', stop: { reason: 'awaiting-input', nodeId: this.waitingNode } })
    }))
    this.it.setUnknownComponentPause((component, nodeId) => new Promise((resolve) => {
      this.unknownResolve = resolve
      this.deliver({ kind: 'stopped', stop: { reason: 'unknown-component', nodeId, detail: { component } } })
    }))
  }

  private stop(s: Stop): Promise<void> {
    return new Promise((resolve) => {
      this.resume = resolve
      this.deliver({ kind: 'stopped', stop: s })
    })
  }

  private deliver(o: Outcome): void {
    const p = this.pending
    this.pending = null
    if (p) p(o)
    else this.early = o
  }

  /** 下一個指令：先把結果的接收者掛好，再放直譯器走。 */
  private command(go: () => void): Promise<Outcome> {
    if (this.ended) return Promise.resolve({ kind: 'ended' })
    return new Promise((resolve) => {
      this.pending = resolve
      go()
      if (this.early && this.pending === resolve) { const e = this.early; this.early = null; this.deliver(e) }
    })
  }

  private release(): void {
    const r = this.resume; this.resume = null
    const u = this.unknownResolve; this.unknownResolve = null
    r?.()
    u?.('continue')
  }

  onOutput(cb: ((text: string) => void) | null): void { this.it.setOutputCallback(cb) }
  setBreakpoints(nodeIds: Iterable<string>): void { this.breakpoints = new Set(nodeIds) }

  launch(program: Parameters<SemanticInterpreter['execute']>[0], options: { stopOnEntry: boolean }): Promise<Outcome> {
    this.stepping = options.stopOnEntry
    return this.command(() => {
      this.it.execute(program).then(
        () => { this.ended = true; this.deliver({ kind: 'ended' }) },
        (e: unknown) => { this.ended = true; this.deliver({ kind: 'failed', error: normalize(e) }) },
      )
    })
  }

  continue(): Promise<Outcome> { this.stepping = false; return this.command(() => this.release()) }
  stepIn(): Promise<Outcome> { this.stepping = true; return this.command(() => this.release()) }

  supplyInput(line: string): Promise<Outcome> {
    return this.command(() => { const r = this.inputResolve; this.inputResolve = null; r?.(line) })
  }
  closeInput(): Promise<Outcome> {
    return this.command(() => { const r = this.inputResolve; this.inputResolve = null; r?.('\x04') })
  }

  pause(): void { this.pausing = true }

  terminate(): void {
    this.it.abort()
    // 停著的那一處也要放開，否則直譯器的 Promise 永遠不會結束
    const u = this.unknownResolve; this.unknownResolve = null
    u?.('stop')
    const r = this.resume; this.resume = null
    r?.()
  }

  variables() { return this.it.snapshotScope() }
  /** 板子的即時狀態只由 Cella 給（形狀照 `@cella-lang/arduino`）；直譯器的腳位狀態不是同一個形狀，不假裝（P6）。 */
  environment(): null { return null }
  setVariable(name: string, raw: string): boolean { return this.it.setVariableFromHost(name, raw) }
  coverage(): ReadonlyMap<string, number> { return this.it.getVisitCounts() }
  recordedInputs() { return this.it.getRecordedInputs() }
}

export const jsInterpreterProvider: Provider = {
  id: 'js-interpreter',
  declares: { session: { granularity: 'node', setInput: false, setVariable: true, steps: true, stepping: true, interactiveInput: true, hardware: false } },
  createSession: (options) => new JsSession(options),
}
