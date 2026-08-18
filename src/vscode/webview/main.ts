/**
 * Webview 的進入點 —— **它只做一件事：用這個宿主的宣告啟動應用**。
 *
 * ## 🔴 而「只做一件事」是這一刀的重點
 *
 * spec 139 的這個檔有 **360 行**：自己組工具箱、自己接 lift、自己做高亮、
 * 自己寫單步、自己畫讀數。而那全部是**網頁版早就有的東西的第二份**。
 *
 * 使用者逐字（2026-08-18）：
 *
 * > 「我要的是像網頁版那樣的面板，越像越好，**只是文字編輯的部分交給 IDE**」
 *
 * 🟢 於是這裡跑的**就是** `App` ——工具列、選擇器、除錯工具列、主控台、
 * 變數、狀態列、版面**全部跟著來**，因為它們本來就在 `App` 裡。
 *
 * > **一次抽象如果沒有換掉任何資料，它換掉的是【誰有權知道什麼】
 * > ——而它的產出常常是「少了多少」，不是「多了什麼」。**
 *
 * ## 這個檔為什麼還需要存在
 *
 * 兩件事只有這裡知道：
 *
 * ```
 * ① 這是哪一個宿主       → 注入 `vscodeProfile`
 * ② Blockly 的 media 根  → 由宿主算出 URI，塞在 `#app` 的 data 屬性上
 * ```
 *
 * ⚠️ 而②是**環境差異**不是行為差異：網頁版從 `import.meta.env.BASE_URL` 取，
 * 這裡從宿主取。**兩邊都是「檔案在哪」，不是「要不要有」。**
 */
import '../../ui/style.css'
import { App } from '../../ui/app'
import { vscodeProfile } from '../vscode-profile'
import { attachDragMeter, type DragMeasurement } from './fps'

async function boot(): Promise<void> {
  const appEl = document.getElementById('app')
  if (!appEl) throw new Error('找不到 #app —— HTML 與這個進入點對不上')

  // Blockly 的圖示與音效在哪。
  // ⚠️ 少一個尾端斜線會變成 `.../mediasprites.png`——而症狀是**破圖但功能還在**
  //    （`vite.config.ts` 檔頭記過同一個病）。
  const raw = appEl.dataset.blocklyMedia ?? ''
  const media = raw && !raw.endsWith('/') ? `${raw}/` : raw
  if (media) {
    // 🔴 走全域而不是參數，因為 `App` 沒有「media 在哪」這個概念
    //    ——那是**環境**，不是應用的組態。
    const w = window as unknown as { __SEMORPHE_BLOCKLY_MEDIA__?: string }
    w.__SEMORPHE_BLOCKLY_MEDIA__ = media
  }

  const app = new App(vscodeProfile)
  ;(window as unknown as { __app?: unknown }).__app = app
  await app.init()

  // 🔴 **診斷【被動】量測，並且只在被問到時回報**（FR-009）。
  //
  // spec 139 把這些數字畫在面板上——而那佔掉了本來該是工具列的位置。
  // ⚠️ 量測沒有被丟掉：它搬去宿主的輸出頻道。
  //
  // > **一個儀器如果佔著產品的版面，它就不只是儀器了。**
  attachDiagnostics(app)
}

/** 把量測掛上去，並回應宿主的查詢。 */
function attachDiagnostics(app: App): void {
  const host = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null
  let last: DragMeasurement | null = null
  // ⚠️ 走既有的除錯把手（網頁版 `src/main.ts:11` 也掛同一個），
  //    而不是替 `App` 開一個新的公開方法——診斷不該擴大產品的介面。
  const ws = (app as unknown as { blocklyPanel?: { getWorkspace(): unknown } })
    .blocklyPanel?.getWorkspace() as Parameters<typeof attachDragMeter>[0] | undefined
  if (ws) attachDragMeter(ws, (m) => { last = m })

  window.addEventListener('message', (e: MessageEvent<{ type?: string }>) => {
    if (e.data?.type !== 'requestDiagnostics') return
    host?.postMessage({
      type: 'diagnostics',
      lines: [
        `畫布拖曳：${last ? `${last.frames} 幀｜中位 ${last.medianMs.toFixed(1)} ms｜p95 ${last.p95Ms.toFixed(1)} ms → ${last.verdict}` : '（還沒有拖過）'}`,
        `判準：中位數 ≤ 20 且 p95 ≤ 33 → 順；中位數 > 33 或 p95 > 100 → 不順`,
      ],
    })
  })
}

declare function acquireVsCodeApi(): { postMessage(m: unknown): void }

boot().catch((err: unknown) => {
  // ⚠️ **失敗要看得見。** 一個空白的面板與一個載壞的面板長得一樣
  //    ——而這個宿主沒有人會去開開發者工具。
  const el = document.getElementById('app')
  const msg = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err)
  if (el) {
    el.innerHTML =
      `<pre style="color:#ef5350;white-space:pre-wrap;font-size:11px;padding:10px">🔴 啟動失敗\n${msg}</pre>`
  }
  console.error('[semorphe] boot failed', err)
})
