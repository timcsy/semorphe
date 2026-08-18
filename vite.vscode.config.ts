import { defineConfig } from 'vite'

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

export default defineConfig(
  target === 'extension'
    ? {
        // 網頁版的 `public/` 不屬於擴充——連 3.6 MB 的 tree-sitter wasm 都會被
        // 複製過來，而本輪一個都用不到。Blockly 的 media 由建置腳本明確複製。
        publicDir: false,
        build: {
          outDir: OUT,
          emptyOutDir: false,
          ssr: true,
          lib: {
            entry: 'src/vscode/extension.ts',
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
