import { defineConfig } from 'vite'
import { cpSync, mkdirSync } from 'node:fs'

/**
 * **把 Blockly 的圖示與音效搬進來自己託管。**
 *
 * Blockly 預設從 `https://blockly-demo.appspot.com/static/media/` 抓
 * `sprites.png`（縮放鈕、垃圾桶）與三個 `.mp3`（點擊／連接／刪除音效）。
 *
 * 🔴 於是**每一個使用者都在向 Google 的 demo 伺服器要東西**，
 * 而離線時那些圖示會壞掉——**壞得很安靜**：只是變破圖，功能還在，
 * 所以沒有人會回報它。（2026-08-15 由委派編譯器的 COEP 探針順手掀出來。）
 *
 * ## ⚠️ 為什麼是【從 node_modules 複製】而不是把檔案簽進版控
 *
 * 簽進去的話，升級 Blockly 時圖示會**默默停在舊版**——而那與上面那個
 * 缺陷是同一族（安靜地不對）。從 `node_modules` 複製**在構造上不可能失同步**。
 *
 * → `public/blockly-media/` 因此在 `.gitignore` 裡：它是產物，不是原始碼。
 *
 * 由第四十五條護欄（`e2e/offline.spec.ts`）守著「執行期零外部請求」。
 */
function copyBlocklyMedia(): void {
  const dest = 'public/blockly-media'
  mkdirSync(dest, { recursive: true })
  cpSync('node_modules/blockly/media', dest, { recursive: true })
}
copyBlocklyMedia()

export default defineConfig({
  base: '/semorphe/',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'monaco-editor': ['monaco-editor'],
        },
      },
    },
  },
})
