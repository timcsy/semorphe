/**
 * **擴充的 webview 也登記 Cella**（spec 198，重構階段 6a）——判決、除錯、覆蓋與網頁版走**同一支** worker（P9 宿主獨立性）。
 *
 * 在這一刀之前擴充只有 JS 直譯器（`src/ui/app.ts` 的組裝點註解）；階段 6 要拆掉它，擴充就得先有 Cella，
 * 否則切換那天擴充裡按執行沒有反應（設計 draft 五之十）。
 *
 * ## 怎麼起 worker
 *
 * ```
 * blob（classic worker）   設 __SEMORPHE_CELLA_BASE__ → importScripts(dist/cella-worker.js)
 * cella-worker.js           vite.vscode.config.ts 的 cella-worker 目標：同一支 worker.ts，iife、資產改從 dist/cella/ 抓
 * ```
 *
 * ⚠️ 為什麼不直接 `new Worker(資源網址)`：webview 的資源網址與文件不同源，worker 不准跨源建；
 *    blob 與文件同源，而 classic worker 的 `importScripts` 只看 CSP 的 `script-src`（不要 CORS）。
 *    CSP 因此多一條 `worker-src blob:`（`webview-html.ts`）。
 */
import { registerProvider } from '../../core/capabilities'
import { createCellaProvider } from '../../providers/cella/provider'

/** `assetBase` 是 `dist/` 的 webview 網址（`main.ts` 的 `__SEMORPHE_ASSET_BASE__`），以 `/` 結尾。 */
export function cellaWorkerBootstrap(assetBase: string): string {
  return `self.__SEMORPHE_CELLA_BASE__ = ${JSON.stringify(`${assetBase}cella/`)};\nimportScripts(${JSON.stringify(`${assetBase}cella-worker.js`)});\n`
}

export function registerCellaInWebview(assetBase: string): void {
  // ⚠️ 先轉成絕對網址：blob worker 裡的相對網址是對 blob: 解析的（預檢頁的根是 `./`）
  const base = new URL(assetBase, location.href).href
  registerProvider(createCellaProvider(() => {
    const url = URL.createObjectURL(new Blob([cellaWorkerBootstrap(base)], { type: 'text/javascript' }))
    return new Worker(url)
  }), { first: true })
}
