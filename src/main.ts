import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'

self.MonacoEnvironment = {
  getWorker() {
    return new editorWorker()
  },
}

import { App } from './ui/app'
import { webProfile } from './ui/host/web-profile'

// 🔴 **注入網頁版的宿主宣告。**
// 應用只認識角色（程式碼視圖／存檔服務／有哪些介面元件），
// 而「這裡是網頁版」這件事只出現在這一行。
const app = new App(webProfile)
;(window as any).__app = app

app.init().catch((err) => {
  console.error('Failed to initialize Semorphe:', err)
  const appEl = document.getElementById('app')
  if (appEl) {
    appEl.innerHTML = `<div style="padding:20px;color:#e74c3c;">初始化失敗: ${err.message}</div>`
  }
})
