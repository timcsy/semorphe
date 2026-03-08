import { App } from './ui/app'

const app = new App()
;(window as any).__app = app

app.init().catch((err) => {
  console.error('Failed to initialize Code Blockly:', err)
  const appEl = document.getElementById('app')
  if (appEl) {
    appEl.innerHTML = `<div style="padding:20px;color:#e74c3c;">初始化失敗: ${err.message}</div>`
  }
})
