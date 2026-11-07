/**
 * **判決結果的快取**（本地版；使用者 2026-11-07 經窗口拍板「判決結果共享快取」：cos-mos 存、Cella 定格式、semorphe 先用）。
 *
 * 鍵 ＝ sha256(判決器模組的雜湊 ＋ 正規化後的程式 JSON ＋ stdin ＋ 步數)
 *
 * - **判決器模組的雜湊**：編好的 wasm 位元組的 sha256——任何 Cella 套件換版、或我們送進去的模組原始碼變了，它就變
 *   （比「套件版本號」嚴：同一個版本號重發也看得出來）。
 * - **正規化後的程式**：`normalizeFormal`（節點編號依第一次出現的順序換成 `#1`…）——每次 lift 都發新的 id，不正規化的話永遠不會命中。
 * - formalize 改了 ⟹ 送出去的程式變了 ⟹ 鍵變了。所以**不需要手動清快取**；它的正確性來自鍵，不來自「記得清」。
 *
 * 判決裡指回節點的字串（`problems[].at` 之類）存的是正規化後的標籤，讀回來時用這一次的對照表換回這一次的 id。
 * 換不回來（標籤不在這一次的表裡）就當作沒命中——不猜。
 *
 * ## 共享存放（2026-11-07，329）：cos-mos 的 `tools/results.mjs`
 *
 * 找得到 cos-mos 的 `results.mjs`（`SEMORPHE_COSMOS_RESULTS` 指定，預設是 repo 旁邊的 `../cos-mos/tools/results.mjs`）時，
 * 非同步那一路（`cachedVerdictAsync`）改走它的 `cachedVerdict`：條目是 Cella 定的 cella-verdict-entry-v1，
 * 鍵 ＝ 程式的 sha256 ＋ Cella 指紋 ＋ { language, fuel, input }，存在 `~/.cos-mos/results/`，與 cos-mos 共享。
 * - 程式送**正規化後的**那一份（節點編號 `#1`…），判決存標籤、讀回換成這一次的 id——同本地版
 * - 指紋**由我們算好傳進去**（`cella-lang/host` 的 `verdictFingerprint`，從 semorphe 自己裝的套件讀）——
 *   讓 `results.mjs` 自己 import 的話，解析到的是 cos-mos 那邊裝的版本
 * - 判決是**報告版**（`<語言>.verdictReport`，多一個 `steps`）——共享條目的格式要求
 * - 找不到 `results.mjs`（CI、別人的機器）就照舊用本地目錄
 *
 * 開關：
 *   SEMORPHE_VERDICT_CACHE=0        關掉（共享與本地都不讀不寫）
 *   SEMORPHE_VERDICT_CACHE=<目錄>   只用本地目錄（預設 ~/.cache/semorphe/verdicts），不走共享
 *   COSMOS_RESULTS=off              發布前／合併前的完整驗收：不讀快取、從頭算當裁判（cos-mos 的約定；本地目錄也一併不讀）
 *   SEMORPHE_COSMOS_RESULTS=<路徑>  cos-mos 的 results.mjs 在哪
 */
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'

export interface VerdictStore {
  get(key: string): string | undefined
  put(key: string, value: string): void
}

/** 一個目錄：`<鍵前兩碼>/<鍵>.json`；寫入先寫暫存檔再改名（並行的測試檔同時寫同一把鍵也不會讀到半份） */
export function directoryStore(dir: string): VerdictStore {
  const file = (key: string): string => join(dir, key.slice(0, 2), `${key}.json`)
  return {
    get: (key) => {
      const f = file(key)
      return existsSync(f) ? readFileSync(f, 'utf8') : undefined
    },
    put: (key, value) => {
      const f = file(key)
      mkdirSync(dirname(f), { recursive: true })
      const tmp = `${f}.${process.pid}.${Date.now()}.tmp`
      writeFileSync(tmp, value)
      renameSync(tmp, f)
    },
  }
}

/** 環境變數決定的存放；`0` ＝ 不快取 */
export function storeFromEnv(env: NodeJS.ProcessEnv = process.env): VerdictStore | null {
  const v = env.SEMORPHE_VERDICT_CACHE
  if (v === '0' || env.COSMOS_RESULTS === 'off') return null
  return directoryStore(v && v.length > 0 ? v : join(homedir(), '.cache', 'semorphe', 'verdicts'))
}

const sha256 = (s: string | Uint8Array): string => createHash('sha256').update(s).digest('hex')

/** 語意樹節點 id 的形狀（`createNode` 發的）：`node_<序號>_<時間戳>`，可帶後綴（`/角色`、`#槽`、`:合成`） */
const ID = /^node_\d+_[a-z0-9]+(?:[/#:].*)?$/
/** 正規化後的標籤：`#<序號>`，可帶同樣的後綴 */
const LABEL = /^#(\d+)((?:[/#:].*)?)$/

const splitLabel = (s: string): [string, string] => {
  const m = /^([^/#:]+)(.*)$/.exec(s)
  return m ? [m[1], m[2]] : [s, '']
}

/**
 * 正規化一份程式，同時交出 id → 標籤的對照表（與 `normalize-formal.ts` 同一條規則：`n` 欄位與長得像 id 的字串都換）。
 * ⚠️ 兩份必須同一條規則——這裡獨立寫一份是因為要拿到表；`verdict-cache.test.ts` 釘住兩者輸出相同。
 */
export function normalizeWithIds(program: unknown): { normalized: unknown; ids: Map<string, string> } {
  const ids = new Map<string, string>()
  const relabel = (label: string): string => {
    const [head, tail] = splitLabel(label)
    if (!ids.has(head)) ids.set(head, `#${ids.size + 1}`)
    return ids.get(head)! + tail
  }
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {}
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = k === 'n' && typeof x === 'string' ? relabel(x) : walk(x)
      return out
    }
    if (typeof v === 'string' && ID.test(v)) return relabel(v)
    return v
  }
  return { normalized: walk(program), ids }
}

/** 判決裡指回節點的字串換成標籤；表裡沒有的 id（判決提到一顆程式裡沒有的節點）回 null——那一筆不存 */
function toLabels(verdict: unknown, ids: Map<string, string>): unknown | null {
  let ok = true
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, walk(x)]))
    if (typeof v === 'string' && ID.test(v)) {
      const [head, tail] = splitLabel(v)
      const l = ids.get(head)
      if (!l) { ok = false; return v }
      return l + tail
    }
    return v
  }
  const out = walk(verdict)
  return ok ? out : null
}

/** 標籤換回這一次的 id；換不回來回 null（當作沒命中） */
function fromLabels(stored: unknown, ids: Map<string, string>): unknown | null {
  const back = new Map([...ids].map(([id, l]) => [l, id]))
  let ok = true
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, walk(x)]))
    if (typeof v === 'string') {
      const m = LABEL.exec(v)
      if (m) {
        const id = back.get(`#${m[1]}`)
        if (!id) { ok = false; return v }
        return id + m[2]
      }
    }
    return v
  }
  const out = walk(stored)
  return ok ? out : null
}

/** 條目的格式版本——格式改了就換號，舊條目自然不命中 */
const ENTRY_FORMAT = 1

export interface VerdictCacheStats { hits: number; misses: number; stored: number }
export const verdictCacheStats: VerdictCacheStats = { hits: 0, misses: 0, stored: 0 }

/**
 * 有快取就讀、沒有就判並寫回。`moduleHash` 是判決器 wasm 位元組的 sha256。
 *
 * ⚠️ 判決裡的字串若剛好以 `#數字` 開頭（例如程式印出 `#1`），存的時候不會被換（它不像 id），
 * 讀回來時卻會被當成標籤——所以存之前先檢查：判決裡已經有長得像標籤的字串，這一筆就不快取。
 */
export function cachedVerdict<V>(
  judge: () => V,
  key: { moduleHash: string; program: unknown; stdin: string; steps: number },
  store: VerdictStore | null = storeFromEnv(),
): V {
  const c = lookup<V>(key, store)
  if (c.hit) return c.value
  const v = judge()
  c.save(v)
  return v
}

/** 同上，判決器可以晚建：全部命中的測試檔就不必付建判決器（wasm 實例化）的那一筆。找得到 cos-mos 的共享存放就走它（見檔頭） */
export async function cachedVerdictAsync<V>(
  judge: () => Promise<V>,
  key: { moduleHash: string; program: unknown; stdin: string; steps: number },
  store: VerdictStore | null = storeFromEnv(),
): Promise<V> {
  const shared = store && !process.env.SEMORPHE_VERDICT_CACHE ? await sharedFromEnv() : null
  if (shared) return viaShared(judge, key, shared)
  const c = lookup<V>(key, store)
  if (c.hit) return c.value
  const v = await judge()
  c.save(v)
  return v
}

type Lookup<V> = { hit: true; value: V } | { hit: false; save: (v: V) => void }

function lookup<V>(key: { moduleHash: string; program: unknown; stdin: string; steps: number }, store: VerdictStore | null): Lookup<V> {
  if (!store) return { hit: false, save: () => {} }
  const { normalized, ids } = normalizeWithIds(key.program)
  const k = sha256(JSON.stringify([ENTRY_FORMAT, key.moduleHash, key.stdin, key.steps, normalized]))
  const got = store.get(k)
  if (got !== undefined) {
    const back = fromLabels(JSON.parse(got), ids)
    if (back !== null) { verdictCacheStats.hits++; return { hit: true, value: back as V } }
  }
  verdictCacheStats.misses++
  return {
    hit: false,
    save: (v) => {
      if (hasLabelLike(v)) return
      const labelled = toLabels(v, ids)
      if (labelled !== null) { store.put(k, JSON.stringify(labelled)); verdictCacheStats.stored++ }
    },
  }
}

function hasLabelLike(v: unknown): boolean {
  if (Array.isArray(v)) return v.some(hasLabelLike)
  if (v && typeof v === 'object') return Object.values(v as Record<string, unknown>).some(hasLabelLike)
  return typeof v === 'string' && LABEL.test(v)
}

export const moduleHashOf = (bytes: Uint8Array): string => sha256(bytes)

// ── 共享存放（cos-mos 的 results.mjs）──────────────────────────────────────────────

/** cos-mos `results.mjs` 的 `cachedVerdict`（契約：只做加法；見 cos-mos 的 tools/results.mjs） */
export type SharedCachedVerdict = (a: {
  program: unknown
  language: string
  options: { fuel: number; input?: string }
  compute: () => Promise<unknown>
  fingerprint: string
}) => Promise<{ verdict: unknown; hit: boolean; key: string }>

export interface SharedVerdictCacheStats { hits: number; misses: number }
export const sharedVerdictCacheStats: SharedVerdictCacheStats = { hits: 0, misses: 0 }

let sharedLoaded: Promise<SharedCachedVerdict | null> | null = null

/** 找得到 cos-mos 的 results.mjs 就載入它的 cachedVerdict；找不到回 null（照舊用本地目錄） */
export function sharedFromEnv(env: NodeJS.ProcessEnv = process.env): Promise<SharedCachedVerdict | null> {
  if (env.SEMORPHE_VERDICT_CACHE === '0' || env.COSMOS_RESULTS === 'off') return Promise.resolve(null)
  sharedLoaded ??= (async () => {
    const at = env.SEMORPHE_COSMOS_RESULTS || join(process.cwd(), '..', 'cos-mos', 'tools', 'results.mjs')
    if (!existsSync(at)) return null
    const mod = await import(/* @vite-ignore */ pathToFileURL(at).href) as { cachedVerdict?: SharedCachedVerdict }
    return typeof mod.cachedVerdict === 'function' ? mod.cachedVerdict : null
  })()
  return sharedLoaded
}

/** Cella 的語言（指紋與鍵用）——與 `branchOf` 同一條規則 */
export function languageOf(program: unknown): 'c' | 'cpp' | 'arduino' | 'python' {
  const p = program as { k?: string; lang?: { k?: string }; board?: unknown }
  if (p?.k === 'program') return 'python'
  if (p?.board != null) return 'arduino'
  return p?.lang?.k === 'langC' ? 'c' : 'cpp'
}

const fingerprints = new Map<string, Promise<string>>()
/** 指紋從 semorphe 自己裝的 `cella-lang/host` 讀（見檔頭：不讓 results.mjs 自己解析） */
function fingerprintOf(language: string): Promise<string> {
  let f = fingerprints.get(language)
  if (!f) {
    f = import('cella-lang/host').then((h) => (h as unknown as { verdictFingerprint(l: string): Promise<string> }).verdictFingerprint(language))
    fingerprints.set(language, f)
  }
  return f
}

/** 判決裡已經有長得像標籤的字串（程式印出 `#1`）——存了讀回會被誤換，所以這一筆不存：用這個例外跳出 compute */
class Unstorable extends Error { constructor(readonly value: unknown) { super('unstorable') } }

async function viaShared<V>(
  judge: () => Promise<V>,
  key: { program: unknown; stdin: string; steps: number },
  shared: SharedCachedVerdict,
): Promise<V> {
  const { normalized, ids } = normalizeWithIds(key.program)
  const language = languageOf(key.program)
  // binding-verdict 用 -1 表示「判決器的預設步數」（1,000,000，見 `checkerFromBytes`）——鍵裡寫實際的數字
  const options: { fuel: number; input?: string } = { fuel: key.steps < 0 ? 1_000_000 : key.steps }
  if (key.stdin !== '') options.input = key.stdin
  try {
    const { verdict, hit } = await shared({
      program: normalized, language, options, fingerprint: await fingerprintOf(language),
      compute: async () => {
        const v = await judge()
        if (hasLabelLike(v)) throw new Unstorable(v)
        const labelled = toLabels(v, ids)
        if (labelled === null) throw new Unstorable(v)
        return labelled
      },
    })
    const back = fromLabels(verdict, ids)
    if (back === null) {
      // 條目指到一顆這一次的程式裡沒有的節點——不猜，當場判
      sharedVerdictCacheStats.misses++
      return judge()
    }
    if (hit) sharedVerdictCacheStats.hits++
    else sharedVerdictCacheStats.misses++
    return back as V
  } catch (e) {
    if (e instanceof Unstorable) { sharedVerdictCacheStats.misses++; return e.value as V }
    throw e
  }
}
