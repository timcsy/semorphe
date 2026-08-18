/**
 * Webview 預檢——**在 Chromium 裡先撞一遍，不要到 IDE 才撞**。
 *
 * ## 它問四件事
 *
 * ```
 * ① 膠囊載進去幾顆     🔴 這是「核搬得過去嗎」的答案
 *                        —— esbuild 那次它是 0，而【建得出來、只發一則 warning】
 * ② 畫布上那顆是誰      SC-003「說得出是哪一顆」
 * ③ CSP 與資源有沒有壞   ⚠️ 這一刀有三個失敗方式【都不會拋錯】
 * ④ 拖起來順不順        SC-004 的判準（而數字由 fps.ts 算，不由人填）
 * ```
 *
 * ## 🔴 它量到的數字**不是 Arduino IDE 的結論**
 *
 * 這裡跑的是 Chromium。Arduino IDE 是 Theia／Electron，
 * 而 `history/080`§五 逐字：「Theia 的 Webview 與 VSCode 的差異**沒有逐項比對過**」。
 *
 * > 在 A 環境驗、宣稱 B 環境成立——那正是 `history/076` 那個錯的形狀。
 *
 * ## 為什麼不是一條 e2e 護欄
 *
 * `playwright.config.ts` 檔頭自己的判準：
 * 「**這件事在 DOM 之外驗得到嗎？驗得到就不要寫進這裡。**」
 *
 * 而這件事在 DOM 之外驗不到（要真的 inject 畫布）——所以它符合寫成 e2e 的條件。
 * ⚠️ **沒有寫成 e2e 是一個明說的取捨**：它需要先跑 `npm run build:vscode`
 * 並起一個 server，而把那個相依塞進 `npm test` 會讓「全套綠」這個訊號變鈍。
 *
 * → **代價**：`webview.js` 若哪天悄悄少載膠囊，`npm test` 不會叫。
 *   要靠有人跑這支。
 *
 * 用法：
 *   npm run build:vscode
 *   node tools/vscode-preflight/run.mjs [--shot out.png]
 */
import { chromium } from '@playwright/test'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'

const DIST = 'build/vscode/dist'
const PORT = 8899
const shotArg = process.argv.indexOf('--shot')
const shot = shotArg > 0 ? process.argv[shotArg + 1] : null

if (!existsSync(`${DIST}/preview.html`)) {
  console.error(`🔴 找不到 ${DIST}/preview.html —— 先跑 \`npm run build:vscode\``)
  process.exit(1)
}

const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: DIST, stdio: 'ignore' })
const stop = () => server.kill()
process.on('exit', stop)
await new Promise((r) => setTimeout(r, 1200))

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 520, height: 620 } })

const errors = []
const failures = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`))
page.on('requestfailed', (r) => failures.push(`${r.url()} :: ${r.failure()?.errorText ?? ''}`))

await page.goto(`http://localhost:${PORT}/preview.html`, { waitUntil: 'networkidle' })
await page.waitForTimeout(4500)

const fatal = await page.evaluate(() => (document.querySelector('#app > pre')?.textContent || '').slice(0, 400))
if (fatal) console.log('🔴 啟動失敗：\n' + fatal)

// ① 介面的區塊——SC-002
const blocks = await page.evaluate(() => ({
  工具列: !!document.querySelector('header'),
  狀態列: !!document.querySelector('footer'),
  積木畫布: !!document.querySelector('.injectionDiv'),
  工具箱分類: document.querySelectorAll('.blocklyToolboxCategory').length,
  快速列按鈕: document.querySelectorAll('.quick-access-bar button').length,
  下方分頁: document.querySelectorAll('.bottom-panel .tab, [id*=tab]').length,
  程式碼編輯區: !!document.querySelector('.monaco-editor'),
  檔案按鈕: !!document.getElementById('file-menu-btn'),
}))
console.log(JSON.stringify(blocks, null, 1))

// ①b 🔴 資源根有沒有被注入
//
// ⚠️ **這一條與②不重疊，而重疊的假象很容易騙過人**：
//    預檢的頁面是一般的 HTTP server，**相對路徑在那裡本來就通**
//    ——所以②在「注入被拿掉」的情況下【仍然會綠】。
//    而在真的 Webview 裡文件有一個合成的網址，相對路徑不成立。
//
// > **一個在寬鬆環境裡跑的檢查，測不到只在嚴格環境裡出現的失敗。
// > 所以要另外驗那個【前提】本身。**
const assetBase = await page.evaluate(() => ({
  media: window.__SEMORPHE_BLOCKLY_MEDIA__ ?? null,
  assets: window.__SEMORPHE_ASSET_BASE__ ?? null,
}))
console.log(`\n資源根：media=${assetBase.media} assets=${assetBase.assets}` +
  (assetBase.media && assetBase.assets ? ' 🟢' : ' 🔴 沒注入 → 真的 Webview 裡會載不到 wasm'))

// ② 🔴 **程式碼 → 積木真的通了嗎**
//
// ⚠️ 這一條 2026-08-18 曾經【消失過】：spec 139 用一個讀數顯示「lift 就緒」，
//    而 spec 140 把那個讀數刪掉之後，預檢就不再檢查 lift 了
//    ——於是 wasm 路徑在真的宿主裡壞掉，而預檢全綠。
//
// > **一個檢查如果依附在某個顯示上，那個顯示被刪掉時它會一起消失
// > ——而沒有人會發現少了一條檢查。**
//
// 所以它現在錨在**行為**上：送一段程式進去，數畫布上有幾顆積木。
const PROGRAM = 'int main() {\n    int x = 1;\n    return 0;\n}\n'
await page.evaluate((text) => {
  window.postMessage({ type: 'document', uri: 'file:///probe.cpp', languageId: 'cpp', text, version: 1 }, '*')
}, PROGRAM)
await page.waitForTimeout(2500)
const lifted = await page.locator('#app .blocklyDraggable').count()
console.log(`\n程式碼 → 積木：畫布上 ${lifted} 顆積木 ${lifted > 0 ? '🟢' : '🔴 lift 沒通'}`)

console.log(`\n請求失敗：${failures.length ? '\n  ' + failures.join('\n  ') : 'none'}`)
console.log(`Console 錯誤：${errors.length ? '\n  ' + errors.join('\n  ') : 'none'}`)
if (shot) { await page.screenshot({ path: shot }); console.log(`截圖：${shot}`) }

const ok = !fatal && errors.length === 0 && failures.length === 0
  && blocks.工具列 && blocks.狀態列 && blocks.積木畫布
  && blocks.工具箱分類 >= 1 && blocks.下方分頁 >= 1
  && !blocks.程式碼編輯區 && !blocks.檔案按鈕
  && lifted > 0 && !!assetBase.media && !!assetBase.assets
if (!ok) console.log('🔴 預檢不通過')

await browser.close()
stop()
process.exit(ok ? 0 : 1)
