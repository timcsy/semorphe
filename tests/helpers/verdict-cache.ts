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
 * 位置與格式可換（等 cos-mos 的共享存放與 Cella 的條目格式）：
 *   SEMORPHE_VERDICT_CACHE=0        關掉
 *   SEMORPHE_VERDICT_CACHE=<目錄>   換位置（預設 ~/.cache/semorphe/verdicts）
 * 存放只要實作 `VerdictStore` 的 get／put。
 */
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'

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
  if (v === '0') return null
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

/** 同上，判決器可以晚建：全部命中的測試檔就不必付建判決器（wasm 實例化）的那一筆 */
export async function cachedVerdictAsync<V>(
  judge: () => Promise<V>,
  key: { moduleHash: string; program: unknown; stdin: string; steps: number },
  store: VerdictStore | null = storeFromEnv(),
): Promise<V> {
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
