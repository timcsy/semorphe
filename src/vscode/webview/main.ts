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
 * 展開成靜態 import——與網頁版同一條路。
 *
 * 🔴 **而 lift／generate／執行【全部】住在這一側也是同一個理由**：
 * 它們都要膠囊登錄表。主行程只負責文件的讀寫與宿主整合。
 *
 * ## 這個檔刻意不碰 `App`
 *
 * `ui/app.ts` 的 `App` 有 31 個欄位，其中 18 個是 per-document 的。
 * **本輪一個都不碰**——面板一次只服務一份文件，那 18 個
 * **從文件重算得出來**（量過 ≈ 13 ms），所以它們不是狀態，是快取。
 */
import * as Blockly from 'blockly'
import { initCppModule } from '../../languages/cpp/module'
import { registeredComponents } from '../../core/component/registry'
import { BlockRegistrar } from '../../ui/block-registrar'
import { LocaleLoader } from '../../i18n/loader'
import { createDarkWorkspaceTheme } from '../../ui/theme/dark-workspace-theme'
import { DEFAULT_CONFIG } from '../sync/settings'
import { setupWorkspace } from './workspace-setup'
import { pickSimplestBlock, placeableSpecs } from '../pick-block'
import { attachDragMeter } from './fps'

function row(label: string, value: string, warn = false): string {
  return `<div class="row"><span class="k">${label}</span><span class="v${warn ? ' warn' : ''}">${value}</span></div>`
}

export async function boot(): Promise<void> {
  const readout = document.getElementById('readout')!
  const canvas = document.getElementById('canvas')!

  // 1. 膠囊登錄表 ＋ 六個引擎。⚠️ 這一行就是「核搬得過去嗎」的答案。
  const { registry } = initCppModule()
  const capsules = registeredComponents().length
  const specs = registry.getAll()

  // 2. i18n——⚠️ 不載的話積木上顯示的是 `%{BKY_U_BREAK_MSG0}` 這種原文。
  //    🔴 而它要在 buildToolbox 之前：工具箱的分類名也走 `Blockly.Msg`。
  const locale = new LocaleLoader()
  locale.setBlocklyMsg(Blockly.Msg as Record<string, string>)
  await locale.load(DEFAULT_CONFIG.locale)

  // 3. 積木定義：登錄表 → Blockly.Blocks
  const workspaceRef: { ws: Blockly.WorkspaceSvg | null } = { ws: null }
  new BlockRegistrar(registry).registerAll({ getWorkspace: () => workspaceRef.ws })

  // 4. 組態 → 工作區（目標／課程清單／風格／工具箱）
  //    ⚠️ 本階段用內建預設；設定接上是 Phase 8 的事。
  const setup = setupWorkspace(registry, DEFAULT_CONFIG)

  // 5. 畫布——**七項全給**，與網頁版 `ui/panels/blockly-panel.ts:122-131` 一致。
  //
  // ⚠️ `media` 少一個尾端斜線的話會變成 `.../mediasprites.png`
  //    ——Blockly 直接把它當前綴接檔名。而症狀是**破圖但功能還在**。
  //
  // 🔴 走 **data 屬性**而不是行內 `<script>` 注入的全域變數：
  //    行內腳本要 CSP 的 nonce，而多一個 nonce 就多一個會漏掉的東西。
  const mediaRaw = canvas.dataset.blocklyMedia ?? ''
  const media = mediaRaw && !mediaRaw.endsWith('/') ? `${mediaRaw}/` : mediaRaw
  const ws = Blockly.inject(canvas, {
    toolbox: setup.toolbox as Blockly.utils.toolbox.ToolboxDefinition,
    renderer: 'zelos',
    theme: createDarkWorkspaceTheme(),
    grid: { spacing: 20, length: 3, colour: '#555', snap: true },
    zoom: { controls: true, wheel: true, startScale: 1.0, maxScale: 3, minScale: 0.3, scaleSpeed: 1.2 },
    trashcan: true,
    media: media || undefined,
  })
  workspaceRef.ws = ws

  // 6. 放一顆積木——**而它是從登錄表挑的**（FR-004）。
  //    ⚠️ 這是第一刀的產物，Phase 4 接上文件之後它會被真的樹取代。
  const chosen = pickSimplestBlock(specs)
  const blockType = (chosen.blockDef as { type: string }).type
  const conceptId = chosen.conceptMapping?.conceptId ?? '(無)'
  const block = ws.newBlock(blockType)
  block.initSvg()
  block.moveBy(220, 60)   // ⚠️ 避開工具箱的寬度——第一版放 (40,40) 被工具箱蓋住了
  ws.render()

  // 7. 讀數——🔴 交棒要看它（見 `specs/139/quickstart.md` 第三節）。
  const categories = (setup.toolbox as { contents?: unknown[] }).contents?.length ?? 0
  const render = (meter = ''): void => {
    readout.innerHTML =
      row('膠囊', String(capsules), capsules < 200) +
      row('積木規格', String(specs.length)) +
      row('可放置候選', String(placeableSpecs(specs).length)) +
      row('工具箱分類', String(categories), categories === 0) +
      row('目標', `${setup.target.id}／${setup.topic.id}／${setup.style.id}`) +
      row('畫布上', `${blockType}（${conceptId}）`) +
      meter
  }
  render()

  // 8. 拖曳量測。判準寫在 `fps.ts`，⚠️ 結論由數字算出，不由人填。
  attachDragMeter(ws, (html) => render(html))

  // 9. 除錯把手——照網頁版 `src/main.ts:11` 的 `window.__app` 慣例。
  //    ⚠️ 它**不是 API**：欄位名隨時會變，沒有人可以依賴它。
  ;(window as unknown as { __semorphe?: unknown }).__semorphe = { Blockly, ws, registry, setup }
}

boot().catch((err: unknown) => {
  // ⚠️ **失敗要看得見**。一個空白的畫布與一個載壞的畫布長得一樣。
  const el = document.getElementById('readout')
  const msg = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err)
  if (el) el.innerHTML = `<pre class="fatal">🔴 啟動失敗\n${msg}</pre>`
  console.error('[semorphe] boot failed', err)
})
