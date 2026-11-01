/**
 * **擴充的 webview 裡讀 Cella 的資產**（spec 198，重構階段 6a）——`assets.ts` 在擴充那一份 worker 裡的替身。
 *
 * 網頁版用 `import.meta.glob` 的 `?url` 讓每個檔變成帶雜湊的網址；擴充的 worker 是 lib 模式打包，
 * 那一招在 lib 模式下會把 45 MB 的套件**全部內嵌成 base64**。所以擴充把套件檔照原樣複製進
 * `dist/cella/<套件>/`（`tools/build-vscode.ts`），worker 啟動時由 webview 告訴它根在哪
 * （`__SEMORPHE_CELLA_BASE__`，見 `src/vscode/webview/cella.ts`）。
 *
 * ⚠️ 檔名沒有雜湊——快取鍵本來就帶套件版本（`cache.ts`），升版不會拿到舊模組。
 */
import type { CellaRead } from './verdict'

const base = (): string => {
  const b = (globalThis as { __SEMORPHE_CELLA_BASE__?: string }).__SEMORPHE_CELLA_BASE__
  if (!b) throw new Error('Cella 的資產根沒有設定（擴充的 webview 沒有把 __SEMORPHE_CELLA_BASE__ 交給 worker）')
  return b.endsWith('/') ? b : `${b}/`
}

export const fetchCellaAsset: CellaRead = async (pkg, file) => {
  const name = `${pkg ?? 'cella-lang'}/${file}`
  const res = await fetch(base() + name)
  if (!res.ok) throw new Error(`Cella 的資產載不下來（${res.status}）：${name}`)
  return new Uint8Array(await res.arrayBuffer())
}
