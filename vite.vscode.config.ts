import { defineConfig, type Plugin } from 'vite'

/**
 * 擴充的建置——**一份設定、兩個目標**。
 *
 * ```
 * SEMORPHE_VSCODE_TARGET=extension   CJS · node · 'vscode' external
 * SEMORPHE_VSCODE_TARGET=webview     ESM · browser · 🔴 膠囊登錄表在這一側
 * ```
 *
 * ## 為什麼是一份設定而不是兩份
 *
 * 兩份會**各自漂移**，而它們有一半的設定共用。這個專案付過那個學費
 * （`history/072`：`c-style-parity` 10/10 全綠，**而瀏覽器上仍然產出
 * `<iostream>`**——兩條產出路徑，一條綠一條錯）。
 *
 * ## 🔴 為什麼**必須**是 Vite（不是 esbuild、不是 tsc 直出）
 *
 * `src/core/component/registry.ts:22-48` 逐字記著實測結果：
 *
 * ```
 * Vite    → CJS 269 KB → node 跑得動 → 189 顆膠囊全部載入   🟢
 * esbuild → CJS 4.6 KB → 🔴 import_meta.glob is not a function
 * ```
 *
 * ⚠️ 而 4.6 KB 那個數字才是重點：**esbuild 建得出來，只是膠囊一顆都沒被
 * 打包進去**，只發一則 warning，執行期才炸。
 *
 * > **一個在建置期只發警告、在執行期才炸的相依，
 * > 會讓「它建得起來」被讀成「它能用」。**
 *
 * 🟢 **而網頁版的 `vite.config.ts` 一個字都不動**（FR-006）。
 */
const target = process.env.SEMORPHE_VSCODE_TARGET ?? 'webview'
const OUT = 'build/vscode/dist'

/**
 * 🔴 **網頁版的擴充主機是第三個目標**（2026-09-10，使用者在 Codespaces 撞到）。
 *
 * ```
 * command 'semorphe.openBlocks' not found
 * ```
 *
 * 指令沒被註冊，因為**擴充根本沒有啟動**：manifest 只宣告了 `main`，
 * 而 `main` 是給 node 擴充主機的。vscode.dev／github.dev／瀏覽器裡的
 * Codespaces 用的是 **web worker 擴充主機**，它只讀 `browser` 那一格。
 *
 * > **一個只宣告了 `main` 的擴充，在網頁版裡不是「壞掉」——
 * > 它是【不存在】，而畫面上只看得到一句「找不到那個指令」。**
 *
 * 🟢 而這一份程式碼**本來就跑得動**：`src/vscode/` 底下一個 node 內建都沒用到
 * （`fs`／`path`／`child_process` 全都是零，量過）。所以這是建置的事，不是重寫。
 *
 * ⚠️ 三個差別，缺一個就是安靜地壞：
 *
 * ```
 * platform  browser   打包進 node 的 polyfill 會讓 worker 當場炸
 * formats   cjs       web worker 擴充主機用 `module.exports` 拿 activate
 * 檔名      extension.web.js   與 node 那份分開——它們的 platform 不同
 * ```
 */
const EXTENSION_ENTRY = 'src/vscode/extension.ts'

/**
 * 🔴 **第四個目標：webview 裡的 Cella worker**（spec 198，重構階段 6a）。
 *
 * 與網頁版**同一支** `providers/cella/worker.ts`——判決、除錯、覆蓋在兩個宿主是同一份程式（P9）。差兩件事：
 *
 * ```
 * formats   iife                 webview 用 classic worker 的 importScripts 載它（blob 啟動，見 src/vscode/webview/cella.ts）
 *                                ——ES module 的 worker 跨來源載入要 CORS，而 webview 的資源網址不保證給
 * assets    SEMORPHE_CELLA_RUNTIME_ASSETS   lib 模式會把 `?url` 的資產內嵌成 base64（45 MB 的套件全進 bundle）；
 *                                改成執行期從 `dist/cella/` 抓（`providers/cella/assets.ts` 的死分支）
 * ```
 */
const CELLA_WORKER_ENTRY = 'src/providers/cella/worker.ts'
const cellaWasmDefaultPath: Plugin = {
  name: 'semorphe-cella-no-default-wasm',
  enforce: 'pre',
  transform(code: string, id: string) {
    if (!id.replace(/\\/g, '/').endsWith('node_modules/cella-lang/cella.js')) return null
    const out = code.replace(/new URL\(\s*['"]cella_bg\.wasm['"]\s*,\s*import\.meta\.url\s*\)/, 'undefined')
    if (out === code) this.error('cella-lang/cella.js 的預設 wasm 路徑找不到了——套件改了寫法，這個外掛要跟著改')
    return { code: out, map: null }
  },
}

export default defineConfig(
  target === 'cella-worker'
    ? {
        publicDir: false,
        plugins: [cellaWasmDefaultPath],
        // `providers/cella/assets.ts` 走執行期的根、glob 搖掉（見那個檔）
        define: { 'import.meta.env.SEMORPHE_CELLA_RUNTIME_ASSETS': JSON.stringify('1') },
        build: {
          outDir: OUT,
          emptyOutDir: false,
          lib: {
            entry: CELLA_WORKER_ENTRY,
            formats: ['iife'],
            name: 'SemorpheCellaWorker',
            fileName: () => 'cella-worker.js',
          },
          rollupOptions: { output: { inlineDynamicImports: true } },
          minify: false,
        },
      }
    : target === 'extension-web'
    ? {
        publicDir: false,
        build: {
          outDir: OUT,
          emptyOutDir: false,
          // ⚠️ **不是 `ssr: true`**——那會把它當成 node 產物，
          //    於是 `platform` 跑掉，而 worker 裡沒有 `process`／`require`。
          lib: {
            entry: EXTENSION_ENTRY,
            formats: ['cjs'],
          },
          rollupOptions: {
            external: ['vscode'],
            output: { entryFileNames: 'extension.web.js' },
          },
          minify: false,
        },
      }
    : target === 'extension'
    ? {
        // 網頁版的 `public/` 不屬於擴充——連 3.6 MB 的 tree-sitter wasm 都會被
        // 複製過來，而本輪一個都用不到。Blockly 的 media 由建置腳本明確複製。
        publicDir: false,
        build: {
          outDir: OUT,
          emptyOutDir: false,
          ssr: true,
          lib: {
            entry: EXTENSION_ENTRY,
            formats: ['cjs'],
          },
          // `vscode` 由宿主在執行期提供——打包進去的話會找不到。
          //
          // ⚠️ `entryFileNames` 是必要的：lib 模式的 `fileName` 會被格式覆寫，
          //    cjs 產出的是 `extension.cjs`，而 manifest 的 `main` 指的是
          //    `extension.js`——**而 vsce 會擋下來**（實測 2026-08-17）。
          rollupOptions: {
            external: ['vscode'],
            output: { entryFileNames: 'extension.js' },
          },
          minify: false,
        },
      }
    : {
        // 網頁版的 `public/` 不屬於擴充——連 3.6 MB 的 tree-sitter wasm 都會被
        // 複製過來，而本輪一個都用不到。Blockly 的 media 由建置腳本明確複製。
        publicDir: false,
        build: {
          outDir: OUT,
          emptyOutDir: true,
          lib: {
            entry: 'src/vscode/webview/main.ts',
            formats: ['es'],
            fileName: () => 'webview.js',
          },
          // 🔴 Webview 裡沒有 node_modules——**全部打包進去**，零外部相依。
          //
          // ⚠️ `inlineDynamicImports` 是刻意的：`i18n/loader.ts` 用
          // `await import('./${localeId}/blocks.json')`，而動態 import 會讓
          // Rollup 切出額外的 chunk。切出來的話**每一塊都要各自過 CSP 與
          // `localResourceRoots`**，而少算一塊的症狀是「積木顯示 `%{BKY_…}`」
          // ——又是一個安靜的壞。一個檔案就沒有這個問題。
          rollupOptions: {
            external: [],
            output: {
              inlineDynamicImports: true,
              // ⚠️ Vite 用 lib 的名字命名 CSS（`semorphe.css`），而 HTML 那側
              //    寫的是 `webview.css`——🔴 **對不上的症狀是 404，而面板【還是會出來】，
              //    只是沒有樣式**。又是一個「不會拋錯的壞」。
              assetFileNames: 'webview[extname]',
            },
          },
          minify: false,
          // Blockly 很大；這個門檻只是不要每次都噴警告。
          chunkSizeWarningLimit: 4096,
        },
      },
)
