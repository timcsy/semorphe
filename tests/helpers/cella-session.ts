/**
 * **測試用的 Cella 工作階段入口**（spec 205 T004，重構 6c-3）——學生按「執行」走的那一條：`createCellaProvider` → `createSession`（DAP）。
 *
 * ```
 * cellaProvider()                 → Cella 提供者，worker 原地跑（同一個行程只有一個；C++、Python 共用）
 * openCella(p, tree, opts)        → 開一個工作階段（翻不出／還沒準備好就拋錯，訊息帶 Cella 的原因）
 * waitSession(p, tree, formal)    → 等那個分支的除錯模組準備好（第一次 createSession 會叫 worker 去準備）
 * cppFormal／pyFormal             → 產品的 formal context（`execution-controller` 交給提供者的那一份）
 * ```
 *
 * 不 mock 判決或工作階段：`worker.ts` 在這個行程裡載入，`self` 是一對互相 postMessage 的假端點。
 * ⚠️ 編好的模組走**產品的建置路**（`fetchPrecompiled` → `/cella-modules/manifest.json`）：這裡把那兩個網址接到
 * `node_modules/.cache/semorphe-cella/`（鍵與 `tools/precompile-cella.ts` 同一份，`tools/cella-module-cache.ts`）——
 * 沒有這一層的話每個測試檔各編一次除錯模組（C++ 約 20 秒、Python 更久）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { createCellaProvider } from '../../src/providers/cella/provider'
import type { ExecutionSession, Provider } from '../../src/core/capabilities'
import type { SemanticNode } from '../../src/core/types'
import { cachedCellaModule } from '../../tools/cella-module-cache'
import { checkerSource, compileCellaChecker, type CellaBranch, type CellaFamily } from '../../src/providers/cella/verdict'
import { compileCellaDebugger, debuggerSource } from '../../src/providers/cella/debugger'

const ROOT = path.resolve(__dirname, '../..')

const readPkg = (pkg: string | null, file: string): Uint8Array =>
  fs.readFileSync(path.join(ROOT, 'node_modules', pkg === null ? 'cella-lang' : `@cella-lang/${pkg}`, file))

/** 建置時編好的模組：名字 → 原始碼與編法（與 `tools/precompile-cella.ts` 的 JOBS 同一套名字） */
function precompiled(name: string): { source: string; compile: () => Promise<Uint8Array> } | null {
  const m = /^(verdict|debugger)-(\w+)$/.exec(name)
  if (!m) return null
  if (m[1] === 'verdict') {
    const f = m[2] as CellaFamily
    return { source: checkerSource(f), compile: () => compileCellaChecker(readPkg, f) }
  }
  const b = m[2] as CellaBranch
  return { source: debuggerSource(b), compile: () => compileCellaDebugger(readPkg, b) }
}

const MODULES = ['verdict-cfamily', 'verdict-python', 'debugger-c', 'debugger-cpp', 'debugger-arduino', 'debugger-python']

const asResponse = (bytes: Uint8Array) => ({
  ok: true, status: 200,
  arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  json: async () => JSON.parse(new TextDecoder().decode(bytes)),
})

let shared: Promise<Provider> | null = null

/** Cella 提供者（C 家族的判決器就緒為止）。同一個測試檔裡只建一次。 */
export function cellaProvider(): Promise<Provider> {
  shared ??= (async () => {
    const g = globalThis as unknown as { self?: { postMessage(m: unknown): void; onmessage?: (e: { data: unknown }) => void }; fetch: typeof fetch }
    const toMain: { onmessage: ((e: { data: unknown }) => void) | null; onerror: null; postMessage(m: unknown): void } = {
      onmessage: null, onerror: null,
      postMessage: (m) => queueMicrotask(() => g.self!.onmessage!({ data: m })),
    }
    g.self = { postMessage: (m) => queueMicrotask(() => toMain.onmessage?.({ data: m })) }
    const realFetch = g.fetch
    g.fetch = (async (url: string) => {
      const u = String(url)
      if (u.startsWith('/cella-modules/')) {
        const file = u.slice('/cella-modules/'.length)
        if (file === 'manifest.json') {
          return asResponse(new TextEncoder().encode(JSON.stringify({ modules: Object.fromEntries(MODULES.map((n) => [n, `${n}.wasm`])) })))
        }
        const job = precompiled(file.replace(/\.wasm$/, ''))
        if (!job) return { ok: false, status: 404 }
        const { bytes } = await cachedCellaModule(file.replace(/\.wasm$/, ''), job.source, job.compile, { root: ROOT })
        return asResponse(bytes)
      }
      // `?url` 在 vitest 裡是 `/node_modules/...`；node_modules 是符號連結（worktree）時是 `/@fs/<絕對路徑>`
      const local = u.startsWith('/@fs/') ? u.slice(4) : u.startsWith('/node_modules/') ? path.join(ROOT, u) : null
      if (!local) return realFetch(url)
      return asResponse(fs.readFileSync(local.replace(/\?.*$/, '')))
    }) as never
    await import('../../src/providers/cella/worker')
    const p = createCellaProvider(() => toMain as unknown as Worker)
    p.warmUp!()
    await until(() => p.readiness!().state === 'ready', 180_000)
    return p
  })()
  return shared
}

export async function until(ok: () => boolean, ms: number): Promise<void> {
  const t = Date.now()
  while (!ok()) {
    if (Date.now() - t > ms) throw new Error('等不到')
    await new Promise((r) => setTimeout(r, 100))
  }
}

export type Formal = { tree: SemanticNode; targetId: string; styleId: string; skeletonId: string }
/** C++ 的 formal context（與 `session-contract` 同一份：apcs 風格、main 骨架） */
export const cppFormal = (tree: SemanticNode): Formal => ({ tree, targetId: 'cpp', styleId: 'apcs', skeletonId: 'main' })
export const pyFormal = (tree: SemanticNode): Formal => ({ tree, targetId: 'python', styleId: 'python', skeletonId: 'none' })

/** 等這支程式的分支（cpp／python…）的除錯模組準備好——之前 createSession 回 declined「還在準備」 */
export async function waitSession(p: Provider, tree: SemanticNode, formal: Formal = cppFormal(tree)): Promise<void> {
  await until(() => {
    const s = p.createSession!({ maxSteps: 1, formal: formal as never }, tree)
    if (!('declined' in s)) return true
    if (/還在準備|還在載入/.test(s.declined)) return false
    throw new Error(`Cella 不接（不是「還在準備」）：${s.declined}`)
  }, 300_000)
}

/** 開一個工作階段；不接就拋錯並帶出原因（翻不出的構造、模組沒準備好……） */
export function openCella(
  p: Provider, tree: SemanticNode, opts: { formal?: Formal; maxSteps?: number } = {},
): { s: ExecutionSession; out: () => string } {
  const s = p.createSession!({ maxSteps: opts.maxSteps ?? 1_000_000, formal: (opts.formal ?? cppFormal(tree)) as never }, tree)
  if ('declined' in s) throw new Error(`Cella 不接：${s.declined}`)
  let text = ''
  s.onOutput((t) => { text += t })
  return { s, out: () => text }
}
