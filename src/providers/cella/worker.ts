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
import { compileCellaChecker, checkerFromBytes, type CellaChecker, type CellaTypes, type CellaVerdict } from './verdict'
import { fetchCellaAsset } from './assets'
import { checkerKey, loadCompiled, saveCompiled } from './cache'

export type WorkerRequest =
  | { id: number; kind: 'load' }
  | { id: number; kind: 'check'; program: unknown; input: string; fuel?: number }
export type WorkerReply =
  | { kind: 'status'; status: 'loading' | 'ready' | 'unavailable'; reason?: string; cached?: boolean }
  | { id: number; kind: 'result'; verdict: CellaVerdict; types: CellaTypes }
  | { id: number; kind: 'skipped' }
  | { id: number; kind: 'error'; reason: string }

const post = (r: WorkerReply): void => (self as unknown as { postMessage(m: WorkerReply): void }).postMessage(r)

/** 先找快取（第二次打開：不下載套件、不編譯）；沒有或載不起來才編。 */
async function build(): Promise<{ checker: CellaChecker; cached: boolean }> {
  const key = await checkerKey().catch(() => null)
  const hit = key ? await loadCompiled(key) : null
  if (hit) {
    try { return { checker: await checkerFromBytes(hit), cached: true } } catch { /* 壞掉的快取 → 重編 */ }
  }
  const bytes = await compileCellaChecker(fetchCellaAsset)
  if (key) void saveCompiled(key, bytes)
  return { checker: await checkerFromBytes(bytes), cached: false }
}

let checker: Promise<CellaChecker> | null = null
function load(): Promise<CellaChecker> {
  if (!checker) {
    post({ kind: 'status', status: 'loading' })
    const built = build()
    checker = built.then((b) => b.checker)
    built.then(
      (b) => post({ kind: 'status', status: 'ready', cached: b.cached }),
      (e: unknown) => post({ kind: 'status', status: 'unavailable', reason: e instanceof Error ? e.message : String(e) }),
    )
  }
  return checker
}

let pending: Extract<WorkerRequest, { kind: 'check' }> | null = null
let draining = false
async function drain(): Promise<void> {
  draining = true
  while (pending) {
    const req = pending
    pending = null
    try {
      const c = await load()
      if (pending) { post({ id: req.id, kind: 'skipped' }); continue }   // 等載入時來了更新的
      post({ id: req.id, kind: 'result', verdict: c.verdict(req.program, req.input, req.fuel), types: c.types(req.program, []) })
    } catch (e) {
      post({ id: req.id, kind: 'error', reason: e instanceof Error ? e.message : String(e) })
    }
    await new Promise((r) => setTimeout(r, 0))   // 讓判決期間到的訊息先進來，再挑最新的
  }
  draining = false
}

self.onmessage = (e: MessageEvent<WorkerRequest>): void => {
  const msg = e.data
  if (msg.kind === 'load') { void load(); return }
  if (pending) post({ id: pending.id, kind: 'skipped' })
  pending = msg
  if (!draining) void drain()
}
