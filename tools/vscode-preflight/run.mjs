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

const readout = async () => (await page.locator('#readout').innerText()).replace(/\n(?=[^\n])/g, ' ')
console.log('── 載入後 ──\n' + (await readout()))

// 🔴 工具箱分類數——SC-009 要求它與網頁版相同。
// ⚠️ 而它從【畫面上】數，不是從設定物件數：一個「建出來了但沒渲染」
//    的工具箱，在設定物件上看起來一模一樣。
const categories = await page.locator('.blocklyToolboxCategory').count()
console.log(`\n工具箱分類（畫面上）：${categories}`)

// ── 模擬宿主送一份文件進來 ──
// ⚠️ 預檢裡沒有真的宿主，所以這裡【扮演】它。
//    🔴 而扮演的是【同一個訊息形狀】，不是另一條路徑。
const PROGRAM = 'int main() {\n    int x = 1;\n    return 0;\n}\n'
await page.evaluate((text) => {
  window.postMessage({ type: 'document', uri: 'file:///probe.cpp', languageId: 'cpp', text, version: 1 }, '*')
}, PROGRAM)
await page.waitForTimeout(300)
console.log('\n── 送入文件後 ──\n' + (await readout()))

// ── 在畫布上放一顆積木 → 應該算得出「改了幾行」 ──
const placed = await page.evaluate(() => {
  const S = window.__semorphe
  const ws = S.panel.getWorkspace()
  const spec = S.registry.getAll().find((x) => {
    const d = x.blockDef ?? {}
    return !x.form && d.type && d.message0 && ('previousStatement' in d || 'nextStatement' in d)
  })
  const b = ws.newBlock(spec.blockDef.type)
  b.initSvg(); b.moveBy(220, 60); ws.render()
  // Blockly 的變更事件是非同步派送的
  return spec.blockDef.type
})
await page.waitForTimeout(500)
const afterEdit = await readout()
console.log(`\n── 放一顆 ${placed} 之後 ──\n` + afterEdit)

const blocks = await page.locator('#canvas .blocklyDraggable').count()
const labels = await page.locator('#canvas svg text').evaluateAll((ns) => ns.map((n) => n.textContent))
console.log(`\n積木數：${blocks}　標籤：${JSON.stringify(labels.slice(0, 4))}`)
const raw = labels.filter((t) => typeof t === 'string' && t.includes('%{BKY_'))
if (raw.length > 0) console.log(`🔴 i18n 沒載：${JSON.stringify(raw)}`)

// 🔴 US1 的管線在 Chromium 裡通了嗎——「這次改了幾行」要是一個數字且 > 0
const spanLines = /上次編輯改了幾行\s+(\d+)/.exec(afterEdit)
console.log(`\n重寫跨距：${spanLines ? spanLines[1] + ' 行' : '🔴 沒算出來'}`)

// ── 單步執行：積木要一顆一顆亮 ──
// 🔴 US4 的重點是【看見程式在積木上走過去】，所以驗的是「高亮換了幾次」。
const execResult = await page.evaluate(async () => {
  const seen = []
  const btn = document.getElementById('step')
  for (let i = 0; i < 4; i++) {
    btn.click()
    await new Promise((r) => setTimeout(r, 250))
    const hl = document.querySelectorAll('.blocklyPath.semorphe-highlight-execution, .semorphe-highlight-execution')
    seen.push(document.getElementById('runstate').textContent)
  }
  document.getElementById('stop').click()
  return { states: seen, out: document.getElementById('out').textContent.slice(0, 120) }
})
console.log(`\n單步：${JSON.stringify(execResult.states)}`)
if (execResult.out) console.log(`輸出：${JSON.stringify(execResult.out)}`)

// 拖曳：往左上拖，⚠️ 往右下會把積木拖出畫布（第一版踩過，症狀是「畫布空白」）
if (blocks > 0) {
  const box = await page.locator('#canvas .blocklyDraggable').first().boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  for (let i = 1; i <= 60; i++) {
    await page.mouse.move(box.x + box.width / 2 - i * 2, box.y + box.height / 2 - i * 0.6 + Math.sin(i / 6) * 20)
    await page.waitForTimeout(12)
  }
  await page.mouse.up()
  await page.waitForTimeout(500)
  console.log('\n── 拖曳後 ──\n' + (await readout()))
}

console.log(`\n資源請求失敗：${failures.length ? '\n  ' + failures.join('\n  ') : 'none'}`)
console.log(`Console 錯誤：${errors.length ? '\n  ' + errors.join('\n  ') : 'none'}`)
if (shot) { await page.screenshot({ path: shot }); console.log(`截圖：${shot}`) }

await browser.close()
stop()
// ⚠️ 入口條件錨在【合成量】：分類數與積木數都要 > 0，
//    否則「零錯誤」只是因為什麼都沒渲染。
const ok = errors.length === 0 && failures.length === 0 && blocks >= 1 && categories >= 1 && spanLines !== null && Number(spanLines[1]) > 0
if (!ok) console.log(`🔴 不通過：錯誤 ${errors.length}｜請求失敗 ${failures.length}｜積木 ${blocks}｜分類 ${categories}｜跨距 ${spanLines ? spanLines[1] : '無'}`)
process.exit(ok ? 0 : 1)
