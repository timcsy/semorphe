import { App } from './ui/App'

const app = new App()

app.init().catch((err) => {
  console.error('Failed to initialize Code Blockly:', err)
  const appEl = document.getElementById('app')
  if (appEl) {
    appEl.innerHTML = `<div style="padding:20px;color:red;">初始化失敗: ${err.message}</div>`
  }
})
