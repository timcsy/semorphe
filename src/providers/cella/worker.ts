/**
 * **Cella 的 Web Worker**（spec 182 T006）——載入、編譯、判決、型別查詢都在這裡，主執行緒不卡。
 *
 * 協定（`provider.ts` 是唯一的另一端）：
 *
 * ```
 * → { id, kind: 'load' }                         開始載入（重複送無害）
 * → { id, kind: 'check', program, input, fuel }  判決＋型別查詢
 * ← { kind: 'status', status, reason? }          loading／ready／unavailable
 * ← { id, kind: 'result', verdict, types }
 * ← { id, kind: 'skipped' }                      排隊時被更新的請求取代（只保留最新一筆，research R10）
 * ← { id, kind: 'error', reason }
 * ```
 */
import { compileCellaChecker, checkerFromBytes, branchOf, familyOf, type CellaChecker, type CellaFamily, type CellaTypes, type CellaVerdict } from './verdict'
import { fetchCellaAsset, fetchPrecompiled } from './assets'
import { checkerKey, loadCompiled, saveCompiled, moduleKey } from './cache'
import { compileCellaDebugger, debuggerSource } from './debugger'
import type { CellaBranch } from './verdict'

/** 跨 worker 的 Outcome（`SessionStop` 是類別，過不了邊界——主執行緒那一側再組回來）。 */
export type WireOutcome =
  | { kind: 'stopped'; stop: { reason: 'entry' | 'breakpoint' | 'step' | 'pause' | 'awaiting-input'; nodeId: string | null; detail?: Record<string, string> } }
  | { kind: 'ended' }
  | { kind: 'failed'; aborted: boolean; key: string; params: Record<string, string>; nodeId: string | null }
  /** Cella 還不支援這支程式裡的某個構造（一步也沒有執行）——退回下一個提供者 */
  | { kind: 'declined'; reason: string }

export type DapOp =
  | { op: 'launch'; stopOnEntry: boolean }
  | { op: 'continue' } | { op: 'stepIn' } | { op: 'closeInput' }
  | { op: 'supplyInput'; text: string }
  | { op: 'setBreakpoints'; nodeIds: string[] }
  | { op: 'setVariable'; name: string; text: string }
  | { op: 'setInput'; key: string; value: string }
  | { op: 'pause' } | { op: 'terminate' }

export type Variable = { name: string; type: string; value: string }

export type WorkerRequest =
  | { id: number; kind: 'load' }
  | { id: number; kind: 'check'; program: unknown; input: string; fuel?: number }
  | { kind: 'dap-prepare'; branch: CellaBranch }
  | { kind: 'dap-open'; sid: number; branch: CellaBranch; program: unknown; maxSteps?: number }
  | { kind: 'dap-op'; sid: number; seq: number; body: DapOp }
export type WorkerReply =
  | { kind: 'status'; status: 'loading' | 'ready' | 'unavailable'; reason?: string; cached?: boolean }
  | { id: number; kind: 'result'; verdict: CellaVerdict; types: CellaTypes }
  | { id: number; kind: 'skipped' }
  | { id: number; kind: 'error'; reason: string }
  | { kind: 'dap-status'; branch: CellaBranch; status: 'loading' | 'ready' | 'unavailable'; reason?: string }
  | { kind: 'dap-output'; sid: number; text: string }
  | { kind: 'dap-result'; sid: number; seq: number; outcome?: WireOutcome; ok?: boolean; message?: string; variables: Variable[]; env: unknown; coverage: Record<string, number> | null }

const post = (r: WorkerReply): void => (self as unknown as { postMessage(m: WorkerReply): void }).postMessage(r)

/** 先找快取（第二次打開：不下載套件、不編譯）；沒有或載不起來才編。 */
async function build(family: CellaFamily): Promise<{ checker: CellaChecker; cached: boolean }> {
  const key = await checkerKey(family).catch(() => null)
  const hit = key ? await loadCompiled(key) : null
  if (hit) {
    try { return { checker: await checkerFromBytes(hit), cached: true } } catch { /* 壞掉的快取 → 重編 */ }
  }
  // 建置時編好的（第 210 刀）——抓得到就不必下載套件檔、不必現場編十幾秒；抓不到才現場編
  const bytes = await fetchPrecompiled(`verdict-${family}`) ?? await compileCellaChecker(fetchCellaAsset, family)
  if (key) void saveCompiled(key, bytes)
  return { checker: await checkerFromBytes(bytes), cached: false }
}

/**
 * 每一族一個判決器，用到才建（spec 197c）。
 * ⚠️ 狀態（`status`）只報 C 家族——它是暖機時建的那一個；Python 第一次遇到 Python 程式才編（那一次判決慢一點，之後走快取）。
 */
const checkers = new Map<CellaFamily, Promise<CellaChecker>>()
function load(family: CellaFamily = 'cfamily'): Promise<CellaChecker> {
  let c = checkers.get(family)
  if (!c) {
    if (family === 'cfamily') post({ kind: 'status', status: 'loading' })
    const built = build(family)
    c = built.then((b) => b.checker)
    checkers.set(family, c)
    built.then(
      (b) => { if (family === 'cfamily') post({ kind: 'status', status: 'ready', cached: b.cached }) },
      (e: unknown) => {
        checkers.delete(family)
        if (family === 'cfamily') post({ kind: 'status', status: 'unavailable', reason: e instanceof Error ? e.message : String(e) })
      },
    )
  }
  return c
}

let pending: Extract<WorkerRequest, { kind: 'check' }> | null = null
let draining = false
async function drain(): Promise<void> {
  draining = true
  while (pending) {
    const req = pending
    pending = null
    try {
      const c = await load(familyOf(branchOf(req.program as never)))
      if (pending) { post({ id: req.id, kind: 'skipped' }); continue }   // 等載入時來了更新的
      post({ id: req.id, kind: 'result', verdict: c.verdict(req.program, req.input, req.fuel), types: c.types(req.program, []) })
    } catch (e) {
      post({ id: req.id, kind: 'error', reason: e instanceof Error ? e.message : String(e) })
    }
    await new Promise((r) => setTimeout(r, 0))   // 讓判決期間到的訊息先進來，再挑最新的
  }
  draining = false
}

// ── 除錯工作階段（spec 183）──────────────────────────────────────────────

/** 一個分支的除錯模組：快取有就直接用，沒有就編（約 20 秒）並存起來。 */
const debuggers = new Map<CellaBranch, Promise<Uint8Array>>()
function debuggerBytes(b: CellaBranch): Promise<Uint8Array> {
  let p = debuggers.get(b)
  if (!p) {
    post({ kind: 'dap-status', branch: b, status: 'loading' })
    p = (async () => {
      const key = await moduleKey(`debugger-${b}`, debuggerSource(b)).catch(() => null)
      const hit = key ? await loadCompiled(key) : null
      if (hit) return hit
      const bytes = await fetchPrecompiled(`debugger-${b}`) ?? await compileCellaDebugger(fetchCellaAsset, b)
      if (key) void saveCompiled(key, bytes)
      return bytes
    })()
    debuggers.set(b, p)
    p.then(
      () => post({ kind: 'dap-status', branch: b, status: 'ready' }),
      (e: unknown) => { debuggers.delete(b); post({ kind: 'dap-status', branch: b, status: 'unavailable', reason: e instanceof Error ? e.message : String(e) }) },
    )
  }
  return p
}

/* eslint-disable @typescript-eslint/no-explicit-any -- cella-lang/dap 沒有型別宣告 */
interface DapSession { sid: number; s: any; last: any; exited: boolean; terminated: boolean; chain: Promise<void>; maxSteps: number | null; overBudget: boolean }
const sessions = new Map<number, Promise<DapSession>>()

function openDap(sid: number, branch: CellaBranch, program: unknown, maxSteps: number | null): void {
  sessions.set(sid, (async () => {
    const { createSession } = await import('cella-lang/dap' as string)
    const s = await createSession(await debuggerBytes(branch), { program: JSON.stringify(program) })
    const d: DapSession = { sid, s, last: null, exited: false, terminated: false, chain: Promise.resolve(), maxSteps, overBudget: false }
    s.onEvent((ev: string, body: any) => {
      if (ev === 'output') post({ kind: 'dap-output', sid, text: String(body.output ?? '') })
      else if (ev === 'stopped') d.last = body
      else if (ev === 'exited') d.exited = true
    })
    return d
  })())
}

/** 未定義行為的種類 → 執行期訊息的鍵（中文說法與 5a 判決的 `DIAG_CELLA_UB_*` 同一套）。 */
const UB_KEY: Record<string, string> = {
  ubUninit: 'RUNTIME_ERR_UB_UNINIT', ubBounds: 'RUNTIME_ERR_UB_BOUNDS', ubOverflow: 'RUNTIME_ERR_UB_OVERFLOW',
  ubDivZero: 'RUNTIME_ERR_UB_DIV_ZERO', ubOverlap: 'RUNTIME_ERR_UB_OVERLAP',
  // spec 205：6c-2 量到的另外兩種（越過結尾、板子上沒有的腳）——原本落到通用的「標準沒有定義」那句
  ubPastEnd: 'RUNTIME_ERR_UB_PAST_END', ubPin: 'RUNTIME_ERR_UB_PIN',
}

const flat = (o: unknown): Record<string, string> =>
  Object.fromEntries(Object.entries((o ?? {}) as Record<string, unknown>).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]))

/** 沒有接住的例外 → 一句話：`EOFError：EOF when reading a line`（C++ 的 what() 同理）；認不出欄位時才退回原文 */
function exceptionText(detail: any): string {
  const d = (detail ?? {}) as Record<string, unknown>
  const parts = [d.type ?? d.name, d.what ?? d.message].filter((x): x is string => typeof x === 'string' && x !== '')
  return parts.length > 0 ? parts.join('：') : JSON.stringify(d)
}

/** DAP 的停下事件 → 跨邊界的 Outcome。 */
function outcomeOf(d: DapSession, launching: boolean): WireOutcome {
  const b = d.last
  // 步數用完（spec 205 T010）：在上限處暫停的，不是學生按的暫停——停成「步數用完」，工作階段到此為止
  if (d.overBudget) return { kind: 'failed', aborted: false, key: 'RUNTIME_ERR_MAX_STEPS', params: { max: String(d.maxSteps ?? '') }, nodeId: b?.nodeId || null }
  if (d.terminated) return { kind: 'failed', aborted: true, key: 'RUNTIME_ERR_ABORTED', params: {}, nodeId: null }
  if (!b) return { kind: 'ended' }
  const nodeId: string | null = b.nodeId || null
  switch (b.reason) {
    case 'entry': case 'breakpoint': case 'step': case 'pause': case 'awaiting-input':
      return { kind: 'stopped', stop: { reason: b.reason, nodeId, ...(b.detail ? { detail: flat(b.detail) } : {}) } }
    case 'undefined-behavior':
      return { kind: 'failed', aborted: false, key: UB_KEY[b.detail?.kind] ?? 'RUNTIME_ERR_UNDEFINED_BEHAVIOR', params: flat(b.detail), nodeId }
    case 'unspecified-behavior':
      return { kind: 'failed', aborted: false, key: 'RUNTIME_ERR_UNSPECIFIED_BEHAVIOR', params: flat(b.detail), nodeId }
    case 'exception':
      // spec 205 T012（D7）：{text} 是學生看到的那一句——原本是整包 JSON（`{"type":"EOFError",…}`），改成「型別：說明」
      return { kind: 'failed', aborted: false, key: 'RUNTIME_ERR_UNCAUGHT_EXCEPTION', params: { ...flat(b.detail), text: exceptionText(b.detail) }, nodeId }
    case 'unsupported':
      // 一步也沒有執行：交給下一個提供者（啟動之後才遇到的不會走到這裡——Cella 在檢查時就判了）
      if (launching) return { kind: 'declined', reason: String(b.detail?.why ?? b.detail?.reason ?? 'unsupported') }
      return { kind: 'failed', aborted: false, key: 'RUNTIME_ERR_CELLA_UNSUPPORTED', params: flat(b.detail), nodeId }
    case 'rejected':
      return { kind: 'failed', aborted: false, key: 'RUNTIME_ERR_CELLA_REJECTED', params: flat(b.detail), nodeId }
    default:
      return { kind: 'ended' }
  }
}

/** 到目前為止每個節點標籤進入幾次（`cella-lang/dap` 的 `coverage()`，spec 194）；結束後照樣讀得到——跑完才是整支的覆蓋。 */
function coverageOf(d: DapSession): Record<string, number> | null {
  try { return d.s.coverage() ?? null } catch { return null }
}

/** 暫停時板子的狀態（`readEnv`）；一般程式是 null。 */
function envOf(d: DapSession): unknown {
  if (d.exited || d.terminated) return null
  try { return d.s.readEnv() } catch { return null }
}

function variablesOf(d: DapSession): Variable[] {
  if (d.exited || d.terminated) return []
  const show = (v: any): Variable => ({ name: String(v.name), type: String(v.type ?? ''), value: v.value === null ? '?' : String(v.value) })
  try {
    return [...(d.s.variables(0) ?? []), ...(d.s.variables('globals') ?? [])].map(show)
  } catch { return [] }
}

async function dapOp(sid: number, seq: number, body: DapOp): Promise<void> {
  const d = await sessions.get(sid)!
  const reply = (r: Partial<Extract<WorkerReply, { kind: 'dap-result' }>>): void =>
    post({ kind: 'dap-result', sid, seq, variables: variablesOf(d), env: envOf(d), coverage: coverageOf(d), ...r })
  // 立即生效的：不排隊（pause 要在執行中送到；terminate 要能打斷）
  if (body.op === 'pause') { d.s.pause(); reply({ ok: true }); return }
  if (body.op === 'terminate') { d.terminated = true; d.s.terminate(); reply({ ok: true }); return }
  if (body.op === 'setBreakpoints') { d.s.setBreakpoints(body.nodeIds); reply({ ok: true }); return }
  d.chain = d.chain.then(async () => {
    if (body.op === 'setInput') {
      const r = d.s.setInput(body.key, body.value)
      reply({ ok: r.ok, message: r.message })
      return
    }
    if (body.op === 'setVariable') {
      const v = (d.s.variables(0) ?? []).concat(d.s.variables('globals') ?? []).find((x: any) => x.name === body.name)
      // DAP 用變數的 id（宣告節點）改值，不是名字——名字 → id 在這裡換
      const r = v ? d.s.setVariable(0, v.id, body.text) : { ok: false, message: `沒有叫 ${body.name} 的變數` }
      reply({ ok: r.ok, message: r.message })
      return
    }
    d.last = null
    // 🔴 步數上限（spec 205 T010）：`cella-lang/dap` 的 fuel 是「每一段」的步數（段與段之間交回事件迴圈），不是總預算——
    //    不另外看的話無窮迴圈要學生自己按停止（JS 直譯器照 maxSteps 停）。段與段之間這個計時器排得進來：
    //    加總各節點走過的次數（與 JS 直譯器的「步」同一個意思），超過就暫停，outcomeOf 把它停成「步數用完」
    const watch = d.maxSteps === null ? null : setInterval(() => {
      const visits = coverageOf(d)
      if (!visits || d.overBudget) return
      let used = 0
      for (const n of Object.values(visits)) used += n
      if (used > d.maxSteps!) { d.overBudget = true; d.s.pause() }
    }, 30)
    try {
      if (body.op === 'launch') await d.s.launch({ stopOnEntry: body.stopOnEntry })
      else if (body.op === 'continue') await d.s.continue()
      else if (body.op === 'stepIn') await d.s.stepIn()
      else if (body.op === 'supplyInput') await d.s.supplyInput(body.text)
      else if (body.op === 'closeInput') await d.s.closeInput()
    } finally {
      if (watch !== null) clearInterval(watch)
    }
    if (d.overBudget) { d.terminated = true; try { d.s.terminate() } catch { /* 已經結束 */ } }
    reply({ outcome: outcomeOf(d, body.op === 'launch') })
  }).catch((e: unknown) => {
    const message = e instanceof Error ? e.message : String(e)
    // spec 205：Cella 的 wasm 內部堆疊溢位（輸出約六千多字之後；已回報 cella）——說得出原因，不落到「說不出是為什麼」
    const key = /Maximum call stack/i.test(message) ? 'RUNTIME_ERR_CELLA_TOO_DEEP' : 'RUNTIME_ERR_FALLBACK'
    reply({ outcome: { kind: 'failed', aborted: false, key, params: { message }, nodeId: null } })
  })
}

self.onmessage = (e: MessageEvent<WorkerRequest>): void => {
  const msg = e.data
  if (msg.kind === 'load') { void load(); return }
  if (msg.kind === 'dap-prepare') { void debuggerBytes(msg.branch).catch(() => undefined); return }
  if (msg.kind === 'dap-open') { openDap(msg.sid, msg.branch, msg.program, msg.maxSteps ?? null); return }
  if (msg.kind === 'dap-op') { void dapOp(msg.sid, msg.seq, msg.body); return }
  if (pending) post({ id: pending.id, kind: 'skipped' })
  pending = msg
  if (!draining) void drain()
}
