import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'

self.MonacoEnvironment = {
  getWorker() {
    return new editorWorker()
  },
}

import { App } from './ui/app'
import { webProfile } from './ui/host/web-profile'
import { registerProvider } from './core/capabilities'
import { createCellaProvider } from './providers/cella/provider'

// 🔴 **Cella 只在網頁版登記**（spec 182／183）——排在 JS 直譯器前面（`first`）。
//    ⚠️ worker 是第一次需要時才建（`warmUp`）——首屏不載 Cella；擴充的 webview 還沒有它。
registerProvider(createCellaProvider(() => new Worker(new URL('./providers/cella/worker.ts', import.meta.url), { type: 'module' })), { first: true })

// 🔴 **注入網頁版的宿主宣告。**
// 應用只認識角色（程式碼視圖／存檔服務／有哪些介面元件），
// 而「這裡是網頁版」這件事只出現在這一行。
const app = new App(webProfile)
;(window as any).__app = app

// 🔴 **init 做完了**——給要「餵一份程式碼進去」的測試等（第 392 刀）。
//    編輯器在 init 的前段就建好了，而後段還會從預設的樹重投影一次、把編輯器寫回預設程式；
//    只等編輯器出現就 `setCode` 的話，那份程式碼會被蓋掉（e2e c-target 間歇紅了一個月的最後一個原因）。
app.init().then(() => {
  (window as any).__appReady = true
  // 判決（Cella，約 35 MB）在首屏之後、瀏覽器閒著的時候才開始載（spec 182）
  // ⚠️ 自動化瀏覽器不自動載：e2e 四個併行的頁面各編一次判決模組，會把機器忙成假紅
  //    （`knowledge/experience.md`〈一支在乾淨機器上綠、在忙碌機器上紅的測試，量到的不是你的改動〉）——要判決的測試自己呼叫 `warmUpChecker()`
  if (!navigator.webdriver) {
    const idle = (window as any).requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1500))
    idle(() => app.warmUpChecker())
  }
}).catch((err) => {
  console.error('Failed to initialize Semorphe:', err)
  const appEl = document.getElementById('app')
  if (appEl) {
    appEl.innerHTML = `<div style="padding:20px;color:#e74c3c;">初始化失敗: ${err.message}</div>`
  }
})
