/**
 * **頁內的輸入對話框**——取代 `window.prompt`。
 *
 * ## 為什麼不能用 `window.prompt`（2026-08-24）
 *
 * 「自訂…」那一筆要問使用者一個值，而 Blockly 的 `dialog.prompt` 預設落回
 * `window.prompt`。三個問題，而第二個是硬的：
 *
 * ```
 * 難看          瀏覽器的原生對話框，與整個介面格格不入
 * 🔴 VSCode 裡【不會出現】   Electron 的 webview 停用了 window.prompt
 *                            ——症狀是【點了沒反應】，而不是報錯
 * 阻塞           它凍住整個頁面（自動化工具也一起凍住）
 * ```
 *
 * 第二點違反 P9 的**宿主獨立性**逐字：「同一套件在瀏覽器和 VSCode 中
 * **語義行為完全相同**」——一個在擴充裡按了沒反應的按鈕不是「行為相同」。
 *
 * ## ⚠️ 它會有第二個消費者
 *
 * `vision.md` 階段 8「執行的誠實」要問使用者「遇到沒看過的東西，你要①②③？」，
 * 而那件事今天用的是 `confirm()`，**同一個病**。
 * 這個檔是那條線的第一步：**問人這件事要走頁面，不走瀏覽器的原生對話框。**
 */
import * as Blockly from 'blockly'
import { msg } from '../core/messages'

/** 把 Blockly 的對話框接到頁面上——組裝點呼叫一次 */
export function installDialogs(): void {
  Blockly.dialog.setPrompt((message, defaultValue, callback) => {
    showPrompt(message, defaultValue, callback)
  })
}

/*
 * 🪦 `showChoice` 已於 2026-08-25 刪除。
 *
 * 它是「VSCode 的 QuickPick 在網頁版沒有對應」的第一版答案（置中對話框）。
 * 而使用者看到兩邊並排之後說「**選單也是學 IDE**」——於是有了
 * `ui/toolbar/quick-pick.ts`：頂端置中、可過濾、鍵盤可走、支援多選。
 *
 * ⚠️ 留這個墓碑是因為**下一個人會問「那時候為什麼不直接做 QuickPick」**：
 * 因為那時只需要「三個選項的一次詢問」，而 QuickPick 的成本要等到
 * 狀態列長出五顆 picker 才划算。
 */
function showPrompt(message: string, defaultValue: string, callback: (value: string | null) => void): void {
  const overlay = document.createElement('div')
  overlay.className = 'semorphe-dialog-overlay'

  const box = document.createElement('div')
  box.className = 'semorphe-dialog'

  const label = document.createElement('div')
  label.className = 'semorphe-dialog-msg'
  label.textContent = message

  const input = document.createElement('input')
  input.className = 'semorphe-dialog-input'
  input.type = 'text'
  input.value = defaultValue

  const row = document.createElement('div')
  row.className = 'semorphe-dialog-row'
  const cancel = document.createElement('button')
  cancel.className = 'semorphe-dialog-btn'
  cancel.textContent = msg('DIALOG_CANCEL', '取消')
  const ok = document.createElement('button')
  ok.className = 'semorphe-dialog-btn semorphe-dialog-primary'
  ok.textContent = msg('DIALOG_OK', '確定')
  row.append(cancel, ok)

  box.append(label, input, row)
  overlay.appendChild(box)
  document.body.appendChild(overlay)

  // ⚠️ **只能回答一次**——回兩次的話呼叫端會把值設兩遍，
  //    而第二次可能是 `null`（取消），於是使用者剛打的字被清掉。
  let done = false
  const finish = (value: string | null): void => {
    if (done) return
    done = true
    overlay.remove()
    callback(value)
  }

  ok.addEventListener('click', () => finish(input.value))
  cancel.addEventListener('click', () => finish(null))
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) finish(null)
  })
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') finish(input.value)
    if (e.key === 'Escape') finish(null)
  })
  input.focus()
  input.select()
}
