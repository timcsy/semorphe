/**
 * **把核心打包成一份可攜的 ESM。**
 *
 * ⚠️ 這一步**用 Vite 是刻意的**：`import.meta.glob` 在這裡被展開成靜態
 * import，於是 332 顆膠囊真的進到產物裡。消費者拿到的是普通 ESM，
 * 用 esbuild／webpack／Node 直接跑都行——**Vite 是我們的工具，不是他們的依賴**。
 *
 * 🔴 `web-tree-sitter` 留成外部：它要載 `.wasm`，路徑由宿主決定。
 */
import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  build: {
    outDir: 'dist-sdk',
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, 'src/sdk/index.ts'),
      formats: ['es'],
      fileName: () => 'semorphe.mjs',
    },
    rollupOptions: { external: ['web-tree-sitter', 'blockly', 'blockly/core'] },
    minify: false,
    target: 'node20',
  },
})
