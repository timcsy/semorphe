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
await page.waitForTimeout(2000)

const read = async () => (await page.locator('#readout').innerText()).replace(/\n(?=[^\n])/g, ' ')
console.log('── 載入後 ──\n' + (await read()))

const blocks = await page.locator('#canvas .blocklyDraggable').count()
const labels = await page.locator('#canvas svg text').evaluateAll((ns) => ns.map((n) => n.textContent))
console.log(`\n積木數：${blocks}　標籤：${JSON.stringify(labels)}`)
// ⚠️ 標籤若長得像 `%{BKY_…}`，代表 i18n 沒載進來——而積木仍然畫得出來。
//    又是一個「壞了但看起來還在」。
const raw = labels.filter((t) => typeof t === 'string' && t.includes('%{BKY_'))
if (raw.length > 0) console.log(`🔴 i18n 沒載：${JSON.stringify(raw)}`)

// 拖曳：往左上拖，⚠️ 往右下會把積木拖出畫布（第一版踩過，症狀是「畫布空白」）
const box = await page.locator('#canvas .blocklyDraggable').first().boundingBox()
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
await page.mouse.down()
for (let i = 1; i <= 60; i++) {
  await page.mouse.move(box.x + box.width / 2 - i * 3.5, box.y + box.height / 2 - i * 4 + Math.sin(i / 6) * 30)
  await page.waitForTimeout(12)
}
await page.mouse.up()
await page.waitForTimeout(500)

console.log('\n── 拖曳後 ──\n' + (await read()))
console.log(`\n資源請求失敗：${failures.length ? '\n  ' + failures.join('\n  ') : 'none'}`)
console.log(`Console 錯誤：${errors.length ? '\n  ' + errors.join('\n  ') : 'none'}`)
if (shot) { await page.screenshot({ path: shot }); console.log(`截圖：${shot}`) }

await browser.close()
stop()
process.exit(errors.length === 0 && failures.length === 0 && blocks >= 1 ? 0 : 1)
