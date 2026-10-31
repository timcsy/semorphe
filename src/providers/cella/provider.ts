/**
 * **Cella 提供者**（spec 182 T007，重構階段 5a）——宣告 `verdict` 與 `types`，排在 JS 直譯器前面。
 *
 * 主執行緒只做兩件便宜的事：把語義樹 formalize 成 Cella 的程式 JSON、把請求轉給 worker。
 * 每個請求帶遞增的編號；回來時不是最新的那一筆就標 `stale`（research R10：判決過期而標錯地方）。
 *
 * formalize 翻不出來的節點不送 worker——直接回一個 `unknown` 判決，每一顆一筆 `unsupported`
 * （與 Cella 自己判 unsupported 是同一個樣子：系統能力不足，不是學生的錯）。
 */
import { SessionStop, type CheckAnswer, type CheckRequest, type Declined, type ExecutionSession, type Outcome, type Provider, type Readiness, type SessionInput, type SessionOptions } from '../../core/capabilities'
import type { SemanticNode } from '../../core/types'
import { branchOf, type CellaBranch } from './verdict'
import { ownerOf, type Verdict } from '../../core/verdict-diagnostics'
import type { HardwareState } from '../../core/hardware'
import { formalize, cellaBoardOf } from './formalize'
import { withEntryFunctions } from './entry'
import { isCDialect } from '../../languages/cpp/target-dialect'
import type { DapOp, Variable, WireOutcome, WorkerReply, WorkerRequest } from './worker'

/** 板子上的 sketch 要模擬到 5 秒（setup 一次、loop 重複）——步數要給夠，否則是 `fuel` 的 unknown（第 394 刀量的）。 */
const fuelOf = (board: string | undefined): number => (board ? 50_000_000 : 1_000_000)

/** 讀標準輸入的構造（Cella 程式 JSON 的建構子與函式名）。 */
const READERS = new Set(['eCin', 'sScanf'])
const READER_CALLS = new Set(['getchar', 'getline', 'scanf', 'fgets', 'gets', 'std::getline'])
export function readsInput(json: unknown): boolean {
  if (Array.isArray(json)) return json.some(readsInput)
  if (!json || typeof json !== 'object') return false
  const o = json as Record<string, unknown>
  if (READERS.has(o.k as string)) return true
  if (o.k === 'eCall' && READER_CALLS.has(String(o.f ?? o.name ?? ''))) return true
  return Object.values(o).some(readsInput)
}

/**
 * 有 `<id>/stmt` 標籤的那些 id——運算式敘述（`exprStmt`）的外殼。Cella 停在那個 `sExpr` 上，而不是裡面的運算式。
 * ⚠️ 只收這一種（spec 185 逐一量的）：其他帶後綴的標籤（`<id>/init`、`<id>/lhs`……）設成中斷點，
 *    Cella 會停在一個與那一行不相干、或拿不到呼叫框的位置——變數面板是空的。
 */
function stmtShells(json: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(json)) { for (const x of json) stmtShells(x, out); return out }
  if (!json || typeof json !== 'object') return out
  const o = json as Record<string, unknown>
  if (typeof o.n === 'string' && o.n.endsWith('/stmt')) out.add(o.n.slice(0, -'/stmt'.length))
  for (const v of Object.values(o)) stmtShells(v, out)
  return out
}

/**
 * 跨邊界的 Outcome → 核心的 Outcome（`SessionStop` 在這一側組回來）。
 * 🔴 停點與錯誤位置的標籤收回成語義樹的 id——運算式敘述的標籤是 `<id>/stmt`，原樣交出去的話積木不會亮（spec 185 量到）。
 */
function toOutcome(w: WireOutcome): Outcome {
  if (w.kind === 'failed') return { kind: 'failed', error: new SessionStop(w.aborted ? 'aborted' : 'runtime', w.key, w.params, w.nodeId ? ownerOf(w.nodeId) : null) }
  if (w.kind === 'stopped') return { kind: 'stopped', stop: { ...w.stop, nodeId: w.stop.nodeId ? ownerOf(w.stop.nodeId) : null } }
  return w
}

/**
 * **主執行緒那一側的工作階段**——每個指令送進 worker，等 `dap-result`；變數快照跟著結果回來，`variables()` 讀快照。
 * `coverage()` 回 null：Cella 的節點進入次數下一版才有（spec 183 R2）。
 */
class CellaSession implements ExecutionSession {
  private seq = 0
  private waiting = new Map<number, (r: Extract<WorkerReply, { kind: 'dap-result' }>) => void>()
  private vars: Variable[] = []
  private env: HardwareState | null = null
  private out: ((text: string) => void) | null = null
  private inputs: SessionInput[] = []

  private readonly sid: number
  private readonly send: (m: WorkerRequest) => void
  /** 有 `<id>/stmt` 外殼的 id（中斷點要連那個外殼一起給）。 */
  private readonly shells: Set<string>
  constructor(sid: number, send: (m: WorkerRequest) => void, program: unknown) {
    this.sid = sid
    this.send = send
    this.shells = stmtShells(program)
  }

  receive(r: WorkerReply): void {
    if (r.kind === 'dap-output') { this.out?.(r.text); return }
    if (r.kind !== 'dap-result') return
    this.vars = r.variables
    this.env = (r.env as HardwareState | null) ?? null
    this.waiting.get(r.seq)?.(r)
    this.waiting.delete(r.seq)
  }

  private op(body: DapOp): Promise<Extract<WorkerReply, { kind: 'dap-result' }>> {
    const seq = ++this.seq
    return new Promise((resolve) => {
      this.waiting.set(seq, resolve)
      this.send({ kind: 'dap-op', sid: this.sid, seq, body })
    })
  }
  private async run(body: DapOp): Promise<Outcome> {
    const r = await this.op(body)
    return r.outcome ? toOutcome(r.outcome) : { kind: 'ended' }
  }

  onOutput(cb: ((text: string) => void) | null): void { this.out = cb }
  setBreakpoints(nodeIds: Iterable<string>): void {
    // id 本身 ＋ 它名下的敘述標籤（spec 185 量的：指定敘述停在 `eAssign <id>`、運算式敘述停在 `sExpr <id>/stmt`）。
    // ⚠️ 不給其他帶後綴的運算式標籤（`<id>/lhs`……）：Cella 會停在拿不到呼叫框的位置，變數面板是空的
    const labels = [...nodeIds].flatMap((id) => (this.shells.has(id) ? [id, `${id}/stmt`] : [id]))
    void this.op({ op: 'setBreakpoints', nodeIds: labels })
  }
  launch(_program: SemanticNode, options: { stopOnEntry: boolean }): Promise<Outcome> { return this.run({ op: 'launch', stopOnEntry: options.stopOnEntry }) }
  continue(): Promise<Outcome> { return this.run({ op: 'continue' }) }
  stepIn(): Promise<Outcome> { return this.run({ op: 'stepIn' }) }
  supplyInput(line: string): Promise<Outcome> {
    this.inputs.push({ kind: 'stdin', value: line })
    return this.run({ op: 'supplyInput', text: line + '\n' })
  }
  closeInput(): Promise<Outcome> { return this.run({ op: 'closeInput' }) }
  pause(): void { void this.op({ op: 'pause' }) }
  terminate(): void { void this.op({ op: 'terminate' }) }
  variables() { return this.vars }
  async setVariable(name: string, raw: string): Promise<boolean> {
    const r = await this.op({ op: 'setVariable', name, text: raw })
    if (r.ok) this.inputs.push({ kind: 'set-variable', name, value: raw })
    return r.ok === true
  }
  environment(): HardwareState | null { return this.env }
  async setInput(key: string, value: string): Promise<{ ok: boolean; message?: string }> {
    const r = await this.op({ op: 'setInput', key, value })
    if (r.ok) this.inputs.push({ kind: 'set-input', key, value })
    return { ok: r.ok === true, ...(r.message ? { message: r.message } : {}) }
  }
  coverage(): null { return null }
  recordedInputs(): readonly SessionInput[] { return this.inputs }
}

export function createCellaProvider(makeWorker: () => Worker): Provider {
  let worker: Worker | null = null
  let state: Readiness = { state: 'idle' }
  const listeners: ((r: Readiness) => void)[] = []
  const setState = (r: Readiness): void => { state = r; listeners.forEach((cb) => cb(r)) }

  const debuggerState = new Map<CellaBranch, 'loading' | 'ready' | 'unavailable'>()
  const sessions = new Map<number, CellaSession>()
  let sid = 0

  let latest = 0
  const waiting = new Map<number, (a: CheckAnswer) => void>()
  const reads = new Map<number, boolean>()
  const answer = (id: number, a: Pick<CheckAnswer, 'verdict' | 'types'>): void => {
    waiting.get(id)?.({ ...a, stale: id !== latest, readsInput: reads.get(id) ?? false })
    waiting.delete(id)
    reads.delete(id)
  }

  const ensure = (): Worker => {
    if (worker) return worker
    try {
      worker = makeWorker()
    } catch (e) {
      setState({ state: 'unavailable', reason: e instanceof Error ? e.message : String(e) })
      throw e
    }
    worker.onmessage = (e: MessageEvent<WorkerReply>): void => {
      const r = e.data
      if (r.kind === 'dap-status') { debuggerState.set(r.branch, r.status); return }
      if (r.kind === 'dap-output' || r.kind === 'dap-result') { sessions.get(r.sid)?.receive(r); return }
      if (r.kind === 'status') {
        setState(r.status === 'unavailable' ? { state: 'unavailable', reason: r.reason ?? '' } : { state: r.status })
      } else if (r.kind === 'result') {
        answer(r.id, { verdict: r.verdict as Verdict, types: r.types })
      } else {
        answer(r.id, { verdict: null, types: null })
      }
    }
    worker.onerror = (e): void => {
      setState({ state: 'unavailable', reason: e.message || 'Cella 的 worker 起不來' })
      for (const id of [...waiting.keys()]) answer(id, { verdict: null, types: null })
    }
    return worker
  }
  const send = (m: WorkerRequest): void => ensure().postMessage(m)

  /** 翻成 Cella 的程式；翻不出來回原因。與判決同一條路（補進入點 → formalize）。 */
  const formalOf = (f: NonNullable<SessionOptions['formal']>): { program: unknown; branch: CellaBranch } | { why: string } => {
    const board = cellaBoardOf(f.targetId)
    const r = formalize(withEntryFunctions(f.tree, f.skeletonId), { board, lang: isCDialect({ id: f.styleId } as never) ? 'c' : 'cpp' })
    if (!r.program) return { why: `Cella 還不支援：${[...new Set(r.unknown.map((u) => u.reason))].join('、')}` }
    return { program: r.program, branch: branchOf(r.program as never) }
  }

  const createSession = (options: SessionOptions): ExecutionSession | Declined => {
    if (!options.formal) return { declined: '這個語言還沒有 Cella' }
    // 還沒暖機 ⟹ 不為了執行去建 worker、載 35 MB（首屏與 e2e 都靠這一條，見 `src/main.ts`）
    if (state.state === 'idle' || state.state === 'loading') return { declined: '判斷功能還在載入' }
    if (state.state === 'unavailable') return { declined: `判斷功能無法使用：${state.reason}` }
    if (!options.formal.tree.componentId.startsWith('cpp:')) return { declined: '這個語言還沒有 Cella' }
    const f = formalOf(options.formal)
    if ('why' in f) return { declined: f.why }
    const st = debuggerState.get(f.branch)
    if (st !== 'ready') {
      // 第一次：背景編好除錯模組（約 20 秒），這一次先交給下一個提供者（research R4）
      if (st === undefined) { try { send({ kind: 'dap-prepare', branch: f.branch }) } catch { /* worker 起不來 */ } }
      return { declined: st === 'unavailable' ? 'Cella 的除錯模組無法使用' : 'Cella 的除錯模組還在準備（第一次約 20 秒）' }
    }
    const id = ++sid
    const s = new CellaSession(id, send, f.program)
    sessions.set(id, s)
    send({ kind: 'dap-open', sid: id, branch: f.branch, program: f.program })
    return s
  }

  return {
    id: 'cella',
    declares: { verdict: true, types: true, session: { granularity: 'node', setInput: true, setVariable: true, steps: true } },
    createSession,
    // 判決只有 C 家族（c／cpp／arduino）的套件，三者在 semorphe 都是 cpp 這個語言
    supports: (language) => language === 'cpp',
    readiness: () => state,
    onReadiness: (cb) => { listeners.push(cb) },
    warmUp: () => { if (state.state === 'idle') try { send({ id: 0, kind: 'load' }) } catch { /* 狀態已是 unavailable */ } },
    check: (req: CheckRequest) => {
      const id = ++latest
      const board = cellaBoardOf(req.targetId)
      const f = formalize(withEntryFunctions(req.tree, req.skeletonId), { board, lang: isCDialect({ id: req.styleId } as never) ? 'c' : 'cpp' })
      if (!f.program) {
        const verdict: Verdict = {
          verdict: 'unknown', basis: 'computed', exit: null, out: '',
          problems: f.unknown.map((u) => ({ kind: 'unsupported', at: u.nodeId, reason: u.reason })),
        }
        return Promise.resolve({ verdict, types: null, stale: false, readsInput: false })
      }
      if (state.state === 'unavailable') return Promise.resolve({ verdict: null, types: null, stale: false, readsInput: false })
      return new Promise<CheckAnswer>((resolve) => {
        waiting.set(id, resolve)
        reads.set(id, readsInput(f.program))
        try {
          send({ id, kind: 'check', program: f.program, input: req.input, fuel: fuelOf(board) })
        } catch {
          answer(id, { verdict: null, types: null })
        }
      })
    },
  }
}
