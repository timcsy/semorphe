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
const blocks = await page.evaluate(() => {
 /** 看得見＝有面積、沒被 display:none／visibility 藏掉。 */
 const seen = (sel) => {
   const el = document.querySelector(sel)
   if (!el) return false
   const r = el.getBoundingClientRect()
   if (r.width < 1 || r.height < 1) return false
   const cs = getComputedStyle(el)
   return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0'
 }
 return ({
  // 🔴 **問「看得見嗎」，不是「在不在 DOM」。**
  //
  // 2026-08-18 實測：`.injectionDiv` 在、`querySelector` 為真、預檢全綠，
  // ⚠️ **而使用者的面板上一顆積木都沒有**——它被行動版 CSS 絕對定位蓋掉了。
  //
  // > **一個只問「存在嗎」的檢查，答得出「在」，
  // > 答不出「使用者看得到嗎」——而後者才是驗收。**
  // 🔴 這個宿主的**控制項全部投影出去了**，所以工具列與快速列都不該存在。
  //    ⚠️ 量「有沒有那條列」還不夠——⬇️ 下面數的是**控制項**，
  //       因為一條只剩商標的列也是浪費，而它 `seen()` 為真。
  工具列: seen('header'),
  快速列: seen('.quick-access-bar'),
  面板內控制項: document.querySelectorAll(
    '#toolbar select, #toolbar button, .quick-access-bar select, .quick-access-bar button').length,
  狀態列: seen('footer'),
  積木畫布: seen('.injectionDiv'),
  工具箱分類: document.querySelectorAll('.blocklyToolboxCategory').length,
  快速列按鈕: document.querySelectorAll('.quick-access-bar button').length,
  // 🔴 選擇器 2026-08-18 修正過一次：原本寫 `[id*=tab]`，而它配到的是
  //    【行動版的分頁列】，不是主控台／變數的分頁。
  //    ⚠️ 那個錯誤一直沒被發現，直到行動版被關掉、數字掉成 0 才暴露
  //    ——**它從來沒有量到它宣稱要量的東西**。
  //
  // > **一個選擇器如果會配到別的東西，它報的數字是真的，
  // > 而它報的【意義】是假的。**
  下方分頁: document.querySelectorAll('.bottom-tab-btn').length,
  // 🔴 主控台在這個宿主是**終端機**——面板裡不該有那一格（2026-08-25）。
  //    ⚠️ 而變數那一格還在（DAP 是第五刀），所以下方分頁不會是 0。
  主控台分頁: [...document.querySelectorAll('.bottom-tab-btn')]
    .some((b) => (b.textContent ?? '').includes('主控台')),
  程式碼編輯區: !!document.querySelector('.monaco-editor'),
  檔案按鈕: !!document.getElementById('file-menu-btn'),
 })
})
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
await page.evaluate((text) => { window.__setDocument__(text) }, PROGRAM)
await page.waitForTimeout(2500)
const lifted = await page.locator('#app .blocklyDraggable').count()
console.log(`\n程式碼 → 積木：畫布上 ${lifted} 顆積木 ${lifted > 0 ? '🟢' : '🔴 lift 沒通'}`)

// ③ 🔴 **積木 → 程式碼真的送得出去嗎——而且【連續兩筆】都收得下嗎**
//
// ⚠️ 使用者 2026-08-18 連續三次回報「沒同步」，而前兩次預檢都是綠的。
//    第三個原因是**版本號永遠差一**：第一筆成功，之後每一筆都被丟掉。
//    🔴 只驗一筆的檢查**永遠抓不到它**。
//
// > **一個只跑一次的檢查，測不到「第二次才壞」的東西。**
//
// 觸發用真的控制項：清空（第一筆）→ 復原（第二筆）。
// 🔴 **面板不畫狀態列的宿主，三態必須送得出去**（2026-08-25）
//
// ⚠️ 這一格**必須在清空 `sent` 之前**量——要看的就是【開機那一筆】，
//    而它正是這一刀修的東西：原本開機那條路徑只重畫面板那條，
//    宿主那條在使用者主動去動同步之前**一格都沒有**。
//
// > **一個「面板不畫、宿主也沒收到」的狀態，
// > 使用者讀到的不是「少一條狀態列」，是「同步壞了」。**
const syncPhase = await page.evaluate(() =>
  window.__HOST__.sent.find((m) => m.type === 'syncPhase') ?? null)
// 🔴 **控制項有沒有交到宿主手上**（2026-08-25，「控制項離開積木面板」）。
//    ⚠️ 同樣要在清空 `sent` 之前量——它跟著開機那一次狀態刷新送出。
//
// > **「面板裡沒有了」只是一半；另一半是「宿主收到了」。
// > 只驗前一半的話，一顆消失的控制項會被判成成功。**
const controls = await page.evaluate(() =>
  window.__HOST__.sent.find((m) => m.type === 'controls') ?? null)
const controlIds = controls ? controls.items.map((i) => i.id) : []
const 值域齊全 = controls
  ? controls.items.filter((i) => i.kind === 'picker').every((i) => (i.options ?? []).length > 0)
  : false
console.log(`\n控制項 → 宿主：${controls
  ? `${controlIds.length} 顆（${controlIds.join(', ')}）｜值域${值域齊全 ? '齊全 🟢' : '有空的 🔴 宿主會開出一個空選單'}`
  : '🔴 一顆都沒送——面板不畫、宿主也不知道'}`)
const phaseReached = !!syncPhase && typeof syncPhase.detail === 'string' && syncPhase.detail.length > 0
console.log(`\n同步三態 → 宿主：${phaseReached
  ? `🟢 ${syncPhase.phase}｜tooltip「${syncPhase.detail}」`
  : syncPhase ? '🔴 送了但 detail 是空的——語言／風格／主題那幾格被丟掉了'
    : '🔴 一筆都沒送——面板不畫、宿主也不知道，三態沒有顯示處'}`)

await page.evaluate(() => { window.__HOST__.sent.length = 0; window.__HOST__.accepted = 0; window.__HOST__.rejected = 0 })
// 🔴 **改走宿主那條路**（2026-08-25）——清空／復原已經搬到分頁標題列，
//    面板裡那兩顆按鈕在這個宿主**不存在**。
//
// ⚠️ 而這一改讓這一段變強了：它現在同時驗
//    「宿主按得動控制項」與「連續兩筆編輯都收得下」。
//
// > **一個因為按鈕搬家而壞掉的檢查，
// > 修法是走新的那條路，不是把按鈕留下來給它按。**
await page.evaluate(() => window.postMessage({ type: 'controlInvoke', id: 'clear' }, '*'))
await page.waitForTimeout(1200)
await page.evaluate(() => window.postMessage({ type: 'controlInvoke', id: 'undo' }, '*'))
await page.waitForTimeout(1800)
const host = await page.evaluate(() => ({
  types: window.__HOST__.sent.map((m) => m.type),
  accepted: window.__HOST__.accepted,
  rejected: window.__HOST__.rejected,
  // 🔴 積木那側要求重送＝**它的鏡像與文件對不上**。正常情況下是 0。
  resent: window.__HOST__.resent,
}))
const twoWay = host.accepted >= 2 && host.rejected === 0 && host.resent === 0
// 🔴 **診斷有沒有走到宿主**（2026-08-25「診斷 → Problems」）。
//    ⚠️ 它跟著同一批編輯送出，所以在這裡量得到。
const problemsSent = host.types.includes('problems')
console.log(`\n診斷 → 宿主：${problemsSent ? '🟢 有送（進 Problems）' : '🔴 一則都沒送——診斷只活在面板裡'}`)
console.log(`\n積木 → 程式碼：宿主收下 ${host.accepted} 筆、丟掉 ${host.rejected} 筆 ` +
  `${twoWay ? '🟢' : '🔴 ' + (host.rejected > 0 ? '版本對不上 → 第二筆之後全被丟掉'
    : host.resent > 0 ? `鏡像對不上（要求重送 ${host.resent} 次）→ 範圍編輯會錯位` : '沒送出去')}` +
  `（訊息：${host.types.join(', ') || '無'}）`)

// ④ 🔴 **開面板不得動到使用者的檔案**（Arduino sketch 的形狀）
//
// ⚠️ 2026-08-18 使用者在 Arduino IDE 實測：面板一開，他的 sketch 就變成
//
// ```cpp
// void setup() { … }
// void loop() { … }
//
// int main() {          ← 應用在【還沒讀到文件之前】就用空工作區產出的
//     return 0;
// }
// ```
//
// > **寫一份你還沒讀過的檔案，寫的一定不是它的內容
// > ——而是「如果它是空的，它會長什麼樣」。**
//
// 這一條用**另一個分頁**跑，因為上面的檢查已經改過文件了。
const SKETCH = 'void setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(1000);\n}\n'
const page2 = await browser.newPage({ viewport: { width: 900, height: 700 } })
const errors2 = []
page2.on('pageerror', (e) => errors2.push(`PAGEERROR ${e.message}`))
await page2.goto(`http://localhost:${PORT}/preview.html`)
await page2.waitForFunction(() => typeof window.__setConfig__ === 'function')
// 🔴 在 App 起來【之前】就設好——正是真宿主的時序（面板建好就送）。
await page2.evaluate((t) => { window.__setConfig__({ targetId: 'arduino' }); window.__setDocument__(t) }, SKETCH)
await page2.waitForTimeout(8000)
const sketchAfter = await page2.evaluate((src) => {
  let t = src
  for (const m of window.__HOST__.sent.filter((x) => x.type === 'applyEdit')) {
    const L = t.split('\n')
    L.splice(m.span.startLine, m.span.endLine - m.span.startLine, ...m.span.lines)
    t = L.join('\n')
  }
  return t
}, SKETCH)
const sketchBlocks = await page2.locator('#app .blocklyDraggable').count()
const sketchResent = await page2.evaluate(() => window.__HOST__.resent)
const untouched = sketchAfter === SKETCH && sketchResent === 0
console.log(`\n開 .ino 面板：檔案${sketchAfter === SKETCH ? '一個字都沒改 🟢' : '被改了 🔴'}` +
  `｜鏡像對帳 ${sketchResent === 0 ? '一致 🟢' : `對不上 ${sketchResent} 次 🔴`}｜自動出現 ${sketchBlocks} 顆積木 ${sketchBlocks > 0 ? '🟢' : '🔴 要手動按才會同步'}`)
if (!untouched) console.log('  變成：\n' + sketchAfter.split('\n').map((l) => '    ' + l).join('\n'))
errors.push(...errors2)
await page2.close()

console.log(`\n請求失敗：${failures.length ? '\n  ' + failures.join('\n  ') : 'none'}`)
console.log(`Console 錯誤：${errors.length ? '\n  ' + errors.join('\n  ') : 'none'}`)
if (shot) { await page.screenshot({ path: shot }); console.log(`截圖：${shot}`) }

const ok = !fatal && errors.length === 0 && failures.length === 0
  && blocks.積木畫布
  // 🔴 **控制項在這個宿主裡歸零**——驗收②。⚠️ 而工具箱與畫布不變（下面兩格）。
  && blocks.面板內控制項 === 0 && !blocks.工具列 && !blocks.快速列
  // 🔴 而它們要真的到了宿主手上——**「消失」與「搬家」的差別就在這一格**。
  && controlIds.length >= 5 && 值域齊全 && problemsSent
  && !blocks.主控台分頁
  && blocks.工具箱分類 >= 1 && blocks.下方分頁 >= 1 && twoWay && untouched && sketchBlocks > 0
  // 🔴 這個宿主**自己有狀態列**——面板裡再畫一條就是同一件事講兩次，
  //    ⚠️ 而 `phaseReached` 是它的另一半：不畫的義務是「交出去」。
  && !blocks.狀態列 && phaseReached
  && !blocks.程式碼編輯區 && !blocks.檔案按鈕
  && lifted > 0 && !!assetBase.media && !!assetBase.assets
if (!ok) console.log('🔴 預檢不通過')

await browser.close()
stop()
process.exit(ok ? 0 : 1)
