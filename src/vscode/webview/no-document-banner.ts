/**
 * 「現在沒有文件可以同步」的橫幅。
 *
 * ## 🔴 為什麼這需要一個檔
 *
 * 2026-08-18 使用者連續兩次回報「沒同步」。第二次的真正原因是：
 * 他開的是 `Untitled-1`——**沒有副檔名、語言是「純文字」**，
 * 而 `panel.ts` 的 `isSupported()` 認不出它，於是宿主那側 `this.doc` 是 `undefined`，
 * `applyEdit` 進來第一行就 `return`。
 *
 * ⚠️ **而畫面上一切正常**：積木在、工具列在、主控台說「程式執行完畢」。
 *
 * > **一個知道自己為什麼不動的元件如果不說，
 * > 使用者看到的就是「壞了」，而不是「條件沒滿足」。**
 *
 * ## 為什麼是宿主層的 UI，不是應用的
 *
 * 「有沒有一份 `.ino` 可以同步」是**這個宿主特有的狀態**——網頁版沒有這回事。
 * 把它做進 `ui/` 會讓網頁版帶著一個永遠不會亮的元件。
 */

import { postToHost } from './host-bridge'

const ID = 'semorphe-no-document'
const TEXT_ID = 'semorphe-no-document-text'

function ensure(): HTMLElement {
  const existing = document.getElementById(ID)
  if (existing) return existing
  const el = document.createElement('div')
  el.id = ID
  // ⚠️ 行內樣式：這個檔不進 `ui/style.css`（那是網頁版與面板共用的那一份）。
  el.style.cssText = [
    'position:absolute', 'left:0', 'right:0', 'top:0', 'z-index:9999',
    'padding:6px 12px', 'font-size:12px', 'line-height:1.5',
    'background:#5a3a00', 'color:#ffd48a', 'border-bottom:1px solid #7a5100',
    'display:none',
  ].join(';')
  const text = document.createElement('span')
  text.id = TEXT_ID
  el.appendChild(text)

  // 🔴 **一顆寫著自己會做什麼的按鈕**，不是一個自動判斷。
  //    使用者要的是「支援選了 C++ 的 Untitled-1」，而新分頁預設是純文字。
  //    ⚠️ 自動改掉使用者編輯器的語言是一個沒有被要求的副作用；這顆按鈕不是。
  const btn = document.createElement('button')
  btn.textContent = '把目前的分頁設成 C++'
  btn.style.cssText = [
    'margin-left:10px', 'padding:2px 10px', 'font-size:12px', 'cursor:pointer',
    'background:#7a5100', 'color:#ffd48a', 'border:1px solid #a06a00', 'border-radius:3px',
  ].join(';')
  btn.addEventListener('click', () => postToHost({ type: 'setLanguageCpp' }))
  el.appendChild(btn)

  document.body.appendChild(el)
  return el
}

/** 顯示原因。 */
export function showNoDocument(reason: string): void {
  const el = ensure()
  const text = document.getElementById(TEXT_ID)
  if (text) text.textContent = `⚠️ ${reason}`
  el.style.display = 'block'
}

export function hideNoDocument(): void {
  const el = document.getElementById(ID)
  if (el) el.style.display = 'none'
}

/**
 * 掛上監聽。
 *
 * ⚠️ 直接聽 `window` 的訊息，**不經過 `CodeView`**——這是宿主層的狀態，
 * 而程式碼視圖的職責是文字，不是解釋宿主的處境。
 */
export function attachNoDocumentBanner(): void {
  window.addEventListener('message', (e: MessageEvent<{ type?: string; reason?: string }>) => {
    if (e.data?.type === 'noDocument') showNoDocument(e.data.reason ?? '沒有可同步的文件。')
    else if (e.data?.type === 'document') hideNoDocument()
  })
}
