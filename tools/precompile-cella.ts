/**
 * **建置時把 Cella 的模組先編好**（第 210 刀）——瀏覽器不再現場編譯。
 *
 * ## 為什麼
 *
 * 2026-11-01 學生反映 semorphe.com「一開始要開一分多鐘」。量到（網路好的情況下）：
 * 判斷功能從開始載到就緒 **79.5 秒**——157 個請求、12.5 MB 的 Cella 套件檔，下載完還要在瀏覽器裡編約 20 秒。
 * 而編出來的模組只跟 Cella 的版本有關（版本是釘死的），**每個使用者的瀏覽器都在重做同一份編譯**。
 *
 * ```
 *               套件檔（現場編）        編好的模組
 * 判決 C 家族     —                  14.6 MB（gzip 2.0 MB）、從 bytes 載入 0.02 秒（Node 量）
 * 除錯 cpp        —                   5.6 MB（gzip 0.9 MB）
 * 合計下載        55.7 MB（gzip 14.3 MB）  只抓用到的那幾個
 * ```
 *
 * ## 產出
 *
 * `<out>/<名字>.<內容雜湊>.wasm` ＋ `<out>/manifest.json`（名字 → 檔名）。檔名帶雜湊：內容不變就永遠是同一個網址，可以永久快取。
 * 編過的以「套件版本 ＋ 模組原始碼」為鍵快取在 `node_modules/.cache/semorphe-cella/`——沒變就不重編（建置不必每次多等 40 秒）。
 *
 * 用法：npx tsx tools/precompile-cella.ts <輸出目錄>
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, rmSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { compileCellaChecker, checkerSource, type CellaBranch, type CellaFamily } from '../src/providers/cella/verdict'
import { compileCellaDebugger, debuggerSource } from '../src/providers/cella/debugger'

const OUT = process.argv[2]
if (!OUT) { console.error('用法：npx tsx tools/precompile-cella.ts <輸出目錄>'); process.exit(2) }
const CACHE = 'node_modules/.cache/semorphe-cella'

const read = (pkg: string | null, file: string): Uint8Array =>
  readFileSync(join('node_modules', pkg === null ? 'cella-lang' : `@cella-lang/${pkg}`, file))

/** 套件版本——任何一個變了，快取鍵就變 */
const versions = (): string => ['cella-lang', ...readdirSync('node_modules/@cella-lang').map((p) => `@cella-lang/${p}`)]
  .sort().map((p) => `${p}@${JSON.parse(readFileSync(join('node_modules', p, 'package.json'), 'utf8')).version}`).join(',')

const sha = (b: Uint8Array | string): string => createHash('sha256').update(b).digest('hex')

/** 要編的模組：判決依家族、除錯依分支（與 worker 用的名字同一套） */
const JOBS: { name: string; source: string; compile: () => Promise<Uint8Array> }[] = [
  ...(['cfamily', 'python'] as CellaFamily[]).map((f) => ({ name: `verdict-${f}`, source: checkerSource(f), compile: () => compileCellaChecker(read, f) })),
  ...(['c', 'cpp', 'arduino', 'python'] as CellaBranch[]).map((b) => ({ name: `debugger-${b}`, source: debuggerSource(b), compile: () => compileCellaDebugger(read, b) })),
]

async function main(): Promise<void> {
  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(OUT, { recursive: true })
  mkdirSync(CACHE, { recursive: true })
  const v = versions()
  const manifest: Record<string, string> = {}
  for (const job of JOBS) {
    const key = sha(`${v}\n${job.source}`)
    const cached = join(CACHE, `${job.name}.${key}.wasm`)
    const t = Date.now()
    let bytes: Uint8Array
    if (existsSync(cached)) bytes = readFileSync(cached)
    else { bytes = await job.compile(); writeFileSync(cached, bytes) }
    const file = `${job.name}.${sha(bytes).slice(0, 12)}.wasm`
    writeFileSync(join(OUT, file), bytes)
    manifest[job.name] = file
    console.log(`  ${job.name.padEnd(18)} ${(bytes.length / 1e6).toFixed(1).padStart(5)} MB  ${existsSync(cached) && Date.now() - t < 1000 ? '（快取）' : `編 ${((Date.now() - t) / 1000).toFixed(1)} 秒`}`)
  }
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({ versions: v, modules: manifest }, null, 2) + '\n')
  console.log(`Cella 模組 ${JOBS.length} 個 → ${OUT}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
