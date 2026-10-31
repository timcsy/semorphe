/**
 * **瀏覽器端讀 Cella 的資產**（spec 182 T005）——`createCellaChecker(read)` 的 `read`。
 *
 * 用 `import.meta.glob` 的 `?url`：建置時每個檔變成一個帶雜湊的網址，部署就跟著走；
 * 執行時才 `fetch`，首屏不載（research R5）。⚠️ 檔名帶雜湊，所以快取鍵不必另外帶版本。
 */
import type { CellaRead } from './verdict'

const CORE = import.meta.glob(
  ['/node_modules/cella-lang/cella_bg.wasm', '/node_modules/cella-lang/stdlib.cell', '/node_modules/cella-lang/modules/*.cell'],
  { query: '?url', import: 'default', eager: true },
) as Record<string, string>
const PACKAGES = import.meta.glob(
  ['/node_modules/@cella-lang/*/*.cell', '/node_modules/@cella-lang/*/index.json'],
  { query: '?url', import: 'default', eager: true },
) as Record<string, string>

/** `pkg` 為 null 是 `cella-lang` 本身。對不到回 undefined（呼叫端要說得出缺哪一個）。 */
export function cellaAssetUrl(pkg: string | null, file: string): string | undefined {
  return pkg === null ? CORE[`/node_modules/cella-lang/${file}`] : PACKAGES[`/node_modules/@cella-lang/${pkg}/${file}`]
}

/** 資產清單的大小——量測與狀態列用（建置後應該是 1 ＋ 1 ＋ 模組數 ＋ 各套件的檔數）。 */
export const cellaAssetCount = (): number => Object.keys(CORE).length + Object.keys(PACKAGES).length

export const fetchCellaAsset: CellaRead = async (pkg, file) => {
  const url = cellaAssetUrl(pkg, file)
  if (!url) throw new Error(`Cella 的資產不在建置裡：${pkg ?? 'cella-lang'}/${file}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Cella 的資產載不下來（${res.status}）：${pkg ?? 'cella-lang'}/${file}`)
  return new Uint8Array(await res.arrayBuffer())
}
