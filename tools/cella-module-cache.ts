/**
 * **編好的 Cella 模組放在哪、用什麼當鍵**——建置工具（`precompile-cella.ts`）與測試（`tests/helpers/cella-run.ts`）共用這一份。
 *
 * 鍵 ＝ sha256(套件版本 ＋ 模組原始碼)：任何一個 Cella 套件升版、或我們送進去的模組原始碼變了，鍵就變。
 * 檔名 `<名字>.<鍵>.wasm`，放在 `node_modules/.cache/semorphe-cella/`。
 *
 * ⚠️ 兩邊各算一份鍵的話，其中一邊改了另一邊會**靜靜對不上**——症狀不是紅，是慢（每個測試檔重編十幾秒；spec 198 的風險 1）。
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

export const CELLA_CACHE_DIR = 'node_modules/.cache/semorphe-cella'

/** 套件版本——任何一個變了，快取鍵就變 */
export function cellaPackageVersions(root = '.'): string {
  const nm = join(root, 'node_modules')
  return ['cella-lang', ...readdirSync(join(nm, '@cella-lang')).map((p) => `@cella-lang/${p}`)]
    .sort().map((p) => `${p}@${JSON.parse(readFileSync(join(nm, p, 'package.json'), 'utf8')).version}`).join(',')
}

export const sha256 = (b: Uint8Array | string): string => createHash('sha256').update(b).digest('hex')

/** 有快取就讀、沒有就編並寫回。回傳 bytes 與「是不是讀快取」 */
export async function cachedCellaModule(
  name: string,
  source: string,
  compile: () => Promise<Uint8Array>,
  opts: { root?: string; versions?: string } = {},
): Promise<{ bytes: Uint8Array; cached: boolean }> {
  const root = opts.root ?? '.'
  const dir = join(root, CELLA_CACHE_DIR)
  mkdirSync(dir, { recursive: true })
  const key = sha256(`${opts.versions ?? cellaPackageVersions(root)}\n${source}`)
  const file = join(dir, `${name}.${key}.wasm`)
  if (existsSync(file)) return { bytes: readFileSync(file), cached: true }
  const bytes = await compile()
  writeFileSync(file, bytes)
  return { bytes, cached: false }
}
