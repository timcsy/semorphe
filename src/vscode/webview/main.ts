/**
 * Webview 那一側的進入點——**畫布住在這裡，而它是瀏覽器環境**。
 *
 * ## 🔴 為什麼「畫布在 Webview」讓一個已知的坑繞得開
 *
 * `core/component/registry.ts:22-48` 記著一個實測過的代價：
 *
 * ```
 * Vite    → CJS 269 KB → node 跑得動 → 189 顆膠囊全部載入   🟢
 * esbuild → CJS 4.6 KB → 🔴 import_meta.glob is not a function
 * ```
 *
 * ⚠️ 而那 4.6 KB 才是重點——**esbuild 建得出來，只是膠囊一顆都沒被打包進去**，
 * 只發一則 warning，執行期才炸。
 *
 * 本檔是 **Vite 的 browser build（ESM）**，`import.meta.glob` 由 Vite 在建置時
 * 展開成靜態 import——與網頁版同一條路。**所以那個坑本輪碰不到。**
 *
 * ⚠️ **但它沒有消失**：擴充主行程（CJS）哪天要跑 lift／generate，
 * 它會原封不動地回來。處置也已經寫在那個檔頭裡（Vite ssr+lib+cjs，已實測）。
 *
 * ## 這個檔刻意不碰 `App`
 *
 * `ui/app.ts` 的 `App` 有 31 個欄位，其中 18 個是 per-document 的
 * （見 `knowledge/draft/2026-08-17-擴充的形狀.md` 第二節）。
 * **本輪一個都不碰**——畫一顆積木只需要「登錄表 ＋ Blockly」，不需要 App。
 */
import * as Blockly from 'blockly'
import { initCppModule } from '../../languages/cpp/module'
import { registeredComponents } from '../../core/component/registry'
import { BlockRegistrar } from '../../ui/block-registrar'
import { LocaleLoader } from '../../i18n/loader'
import { pickSimplestBlock, placeableSpecs } from '../pick-block'
import { attachDragMeter } from './fps'

function row(label: string, value: string, warn = false): string {
  const cls = warn ? ' class="warn"' : ''
  return `<div class="row"><span class="k">${label}</span><span class="v"${cls}>${value}</span></div>`
}

export async function boot(): Promise<void> {
  const readout = document.getElementById('readout')!
  const canvas = document.getElementById('canvas')!

  // 1. 膠囊登錄表 ＋ 六個引擎。⚠️ 這一行就是「核搬得過去嗎」的答案。
  const { registry } = initCppModule()
  const capsules = registeredComponents().length
  const specs = registry.getAll()

  // 2. i18n——⚠️ 不載的話積木上顯示的是 `%{BKY_U_BREAK_MSG0}` 這種原文。
  const locale = new LocaleLoader()
  locale.setBlocklyMsg(Blockly.Msg as Record<string, string>)
  await locale.load('zh-TW')

  // 3. 積木定義：登錄表 → Blockly.Blocks
  const workspaceRef: { ws: Blockly.WorkspaceSvg | null } = { ws: null }
  new BlockRegistrar(registry).registerAll({ getWorkspace: () => workspaceRef.ws })

  // 4. 畫布。
  //
  // ⚠️ `media` 少一個尾端斜線的話會變成 `.../mediasprites.png`
  //    ——Blockly 直接把它當前綴接檔名。而症狀是**破圖但功能還在**，
  //    所以這裡顯式補（見 `contracts/webview-host.md` 第二節）。
  //
  // 🔴 走 **data 屬性**而不是行內 `<script>` 注入的全域變數：
  //    行內腳本要 CSP 的 nonce，而多一個 nonce 就多一個會漏掉的東西。
  const mediaRaw = canvas.dataset.blocklyMedia ?? ''
  const media = mediaRaw && !mediaRaw.endsWith('/') ? `${mediaRaw}/` : mediaRaw
  const ws = Blockly.inject(canvas, {
    media: media || undefined,
    // 🔴 工具箱明確排除在本輪之外——一顆積木不需要它。
    zoom: { controls: true, wheel: true, startScale: 1.0 },
    trashcan: true,
  })
  workspaceRef.ws = ws

  // 5. 放一顆積木——**而它是從登錄表挑的**（FR-004）。
  const chosen = pickSimplestBlock(specs)
  const blockType = (chosen.blockDef as { type: string }).type
  const conceptId = chosen.conceptMapping?.conceptId ?? '(無)'
  const block = ws.newBlock(blockType)
  block.initSvg()
  block.moveBy(40, 40)
  ws.render()

  // 6. 讀數——🔴 SC-003 要「說得出是哪一顆」，而這裡就是它說出來的地方。
  const render = (meter = ''): void => {
    readout.innerHTML =
      row('膠囊', String(capsules), capsules < 200) +
      row('積木規格', String(specs.length)) +
      row('可放置候選', String(placeableSpecs(specs).length)) +
      row('畫布上', blockType) +
      row('概念身分', conceptId) +
      meter
  }
  render()

  // 7. 拖曳量測（SC-004）。判準寫在 `fps.ts`，⚠️ 結論由數字算出，不由人填。
  attachDragMeter(ws, (html) => render(html))

  // 8. 除錯把手——照網頁版 `src/main.ts:11` 的 `window.__app` 慣例。
  //
  // 🟢 它讓「在真的宿主裡量一件事」不必每次改程式碼重打包。
  //    第一個用途：量 Blockly 畫 N 顆積木要多久（切分頁的成本）。
  // ⚠️ 而它**不是 API**：欄位名隨時會變，沒有人可以依賴它。
  ;(window as unknown as { __semorphe?: unknown }).__semorphe = { Blockly, ws, registry }
}

boot().catch((err: unknown) => {
  // ⚠️ **失敗要看得見**。一個空白的畫布與一個載壞的畫布長得一樣，
  // 而這一刀的驗收是「面板打得開、上面有積木」——
  // 沒有這一段的話，「畫布空白」會被讀成「沒跑起來」而查不出為什麼。
  const el = document.getElementById('readout')
  const msg = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err)
  if (el) el.innerHTML = `<pre class="fatal">🔴 啟動失敗\n${msg}</pre>`
  console.error('[semorphe] boot failed', err)
})
