/**
 * **瀏覽器端讀 Cella 的資產**（spec 182 T005）——`createCellaChecker(read)` 的 `read`。
 *
 * 用 `import.meta.glob` 的 `?url`：建置時每個檔變成一個帶雜湊的網址，部署就跟著走；
 * 執行時才 `fetch`，首屏不載（research R5）。⚠️ 檔名帶雜湊，所以快取鍵不必另外帶版本。
 */
import type { CellaRead } from './verdict'

/**
 * 🔴 **擴充的 webview 那一份走執行期的根**（spec 198）：worker 在擴充裡是 lib 模式打包，`?url` 的資產會被內嵌成 base64（45 MB）。
 * 那一份建置定義 `SEMORPHE_CELLA_RUNTIME_ASSETS`（`vite.vscode.config.ts`）→ 下面兩個 glob 在死分支裡、被搖掉；
 * 套件檔照原樣在 `dist/cella/`，根由 webview 交給 worker（`__SEMORPHE_CELLA_BASE__`，見 `src/vscode/webview/cella.ts`）。
 * ⚠️ 只有一個 `fetchCellaAsset`——兩份同名的實作會漂移（第三十八條護欄）。
 */
const RUNTIME_ASSETS = import.meta.env.SEMORPHE_CELLA_RUNTIME_ASSETS === '1'

function runtimeBase(): string {
  const b = (globalThis as { __SEMORPHE_CELLA_BASE__?: string }).__SEMORPHE_CELLA_BASE__
  if (!b) throw new Error('Cella 的資產根沒有設定（擴充的 webview 沒有把 __SEMORPHE_CELLA_BASE__ 交給 worker）')
  return b.endsWith('/') ? b : `${b}/`
}

const CORE = RUNTIME_ASSETS ? {} : import.meta.glob(
  ['/node_modules/cella-lang/cella_bg.wasm', '/node_modules/cella-lang/stdlib.cell', '/node_modules/cella-lang/modules/*.cell'],
  { query: '?url', import: 'default', eager: true },
) as Record<string, string>
const PACKAGES = RUNTIME_ASSETS ? {} : import.meta.glob(
  ['/node_modules/@cella-lang/*/*.cell', '/node_modules/@cella-lang/*/index.json'],
  { query: '?url', import: 'default', eager: true },
) as Record<string, string>

/** `pkg` 為 null 是 `cella-lang` 本身。對不到回 undefined（呼叫端要說得出缺哪一個）。 */
export function cellaAssetUrl(pkg: string | null, file: string): string | undefined {
  if (RUNTIME_ASSETS) return `${runtimeBase()}${pkg ?? 'cella-lang'}/${file}`
  return pkg === null ? CORE[`/node_modules/cella-lang/${file}`] : PACKAGES[`/node_modules/@cella-lang/${pkg}/${file}`]
}

/** 資產清單的大小——量測與狀態列用（建置後應該是 1 ＋ 1 ＋ 模組數 ＋ 各套件的檔數）。 */
export const cellaAssetCount = (): number => Object.keys(CORE).length + Object.keys(PACKAGES).length

/**
 * **建置時編好的模組**（第 210 刀，`tools/precompile-cella.ts`）——`verdict-cfamily`、`debugger-cpp`…
 * 網頁版在 `BASE_URL/cella-modules/`，擴充在 `dist/cella-modules/`（`dist/cella/` 的旁邊）。
 * 沒有（開發模式沒跑預先編譯）或抓不到 → `null`，呼叫端退回現場編譯。
 */
const modulesBase = (): string => (RUNTIME_ASSETS ? `${runtimeBase()}../cella-modules/` : `${import.meta.env.BASE_URL ?? '/'}cella-modules/`)
let manifest: Promise<Record<string, string> | null> | null = null
export async function fetchPrecompiled(name: string): Promise<Uint8Array | null> {
  try {
    manifest ??= fetch(modulesBase() + 'manifest.json').then((r) => (r.ok ? r.json() : null)).then((m) => m?.modules ?? null).catch(() => null)
    const file = (await manifest)?.[name]
    if (!file) return null
    const res = await fetch(modulesBase() + file)
    return res.ok ? new Uint8Array(await res.arrayBuffer()) : null
  } catch {
    return null
  }
}

export const fetchCellaAsset: CellaRead = async (pkg, file) => {
  const url = cellaAssetUrl(pkg, file)
  if (!url) throw new Error(`Cella 的資產不在建置裡：${pkg ?? 'cella-lang'}/${file}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Cella 的資產載不下來（${res.status}）：${pkg ?? 'cella-lang'}/${file}`)
  return new Uint8Array(await res.arrayBuffer())
}
