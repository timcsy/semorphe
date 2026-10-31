/**
 * **Cella 提供者**（spec 182 T007，重構階段 5a）——宣告 `verdict` 與 `types`，排在 JS 直譯器前面。
 *
 * 主執行緒只做兩件便宜的事：把語義樹 formalize 成 Cella 的程式 JSON、把請求轉給 worker。
 * 每個請求帶遞增的編號；回來時不是最新的那一筆就標 `stale`（research R10：判決過期而標錯地方）。
 *
 * formalize 翻不出來的節點不送 worker——直接回一個 `unknown` 判決，每一顆一筆 `unsupported`
 * （與 Cella 自己判 unsupported 是同一個樣子：系統能力不足，不是學生的錯）。
 */
import type { CheckAnswer, CheckRequest, Provider, Readiness } from '../../core/capabilities'
import type { Verdict } from '../../core/verdict-diagnostics'
import { formalize, cellaBoardOf } from './formalize'
import { withEntryFunctions } from './entry'
import { isCDialect } from '../../languages/cpp/target-dialect'
import type { WorkerReply, WorkerRequest } from './worker'

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

export function createCellaProvider(makeWorker: () => Worker): Provider {
  let worker: Worker | null = null
  let state: Readiness = { state: 'idle' }
  const listeners: ((r: Readiness) => void)[] = []
  const setState = (r: Readiness): void => { state = r; listeners.forEach((cb) => cb(r)) }

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

  return {
    id: 'cella',
    declares: { verdict: true, types: true },
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
