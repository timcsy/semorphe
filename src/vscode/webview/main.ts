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
}

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
