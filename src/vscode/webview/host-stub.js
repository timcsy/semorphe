/**
 * 預檢頁的**假宿主**——⚠️ 它不是一個「把訊息記下來」的樁，它**真的跑同步協定**。
 *
 * ## 🔴 為什麼要跑協定，不只是記訊息
 *
 * 2026-08-18 使用者連續三次回報「沒同步」，而前兩次的預檢都是綠的。
 * 其中一個原因是**版本號永遠差一**：宿主套用編輯之後版本前進，
 * 回音守衛擋掉文件回送，於是 Webview 的 baseVersion 停在編輯前
 * ——**第一筆成功，之後每一筆都被丟掉**。
 *
 * 一個只記訊息的樁看到的是「有送出 applyEdit」，而那正是它會綠的原因。
 *
 * > **要驗一個協定，模擬那一端就得【會回話】——
 * > 只會收不會回的假宿主，驗得到「有沒有送」，驗不到「收不收得下」。**
 *
 * 它模擬三件事，每一件都對應 panel.ts 的一段：
 *   ① applyEdit 的版本比對（對不上就丟掉並重送文件）
 *   ② 套用成功之後回 applied（新的版本號）
 *   ③ 收到 ready 就重送組態與文件
 *      ⚠️ ③ 少了的話，「面板起來之前送的東西沒有人接」這個競態
 *         會被預檢顯示成正常——而使用者在 Arduino IDE 撞到的正是它。
 *
 * ## ⚠️ 為什麼它住在一個【真的 .js 檔】而不是建置腳本裡的樣板字串
 *
 * 它原本是 build-vscode.ts 裡的一個樣板字串，而那讓**任何一個反引號**
 * 都會把它切斷——2026-08-18 一天之內踩到三次，而症狀每次都不一樣。
 *
 * > **一段程式碼如果住在字串裡，它就沒有語法檢查、沒有高亮、
 * > 也沒有「哪一個字元有特殊意義」的直覺。**
 *
 * 處置不是「小心不要打反引號」——是**讓它不再是字串**。
 * 建置時 readFileSync 原樣寫進 dist/。
 *
 * 🔴 這個檔**只寫進預檢頁**；真面板的 HTML 不含它。
 */
;(function () {
  var text = '', version = 0, config = null
  var log = { sent: [], accepted: 0, rejected: 0 }
  window.__HOST__ = log
  function sendDoc() {
    window.postMessage({ type: 'document', uri: 'file:///probe.cpp', languageId: 'cpp', text: text, version: version }, '*')
  }
  window.__setDocument__ = function (t) { text = t; version += 1; sendDoc() }
  window.__setConfig__ = function (c) {
    config = c
    window.postMessage({ type: 'config', config: config }, '*')
  }
  function applySpan(span) {
    var lines = text.split('\n')
    lines.splice(span.startLine, span.endLine - span.startLine)
    for (var i = span.lines.length - 1; i >= 0; i--) lines.splice(span.startLine, 0, span.lines[i])
    text = lines.join('\n')
  }
  window.acquireVsCodeApi = function () {
    return {
      postMessage: function (m) {
        log.sent.push(m)
        // 🔴 **與 panel.ts 一樣要回應 `ready`。** 面板建好時送出的組態與文件
        //    可能在腳本載完之前就到了——沒有人接，而它不會重送。
        //    ⚠️ 假宿主若不模擬這一步，預檢會把那個競態顯示成正常。
        if (m.type === 'ready') {
          if (config) window.postMessage({ type: 'config', config: config }, '*')
          sendDoc()
          return
        }
        if (m.type !== 'applyEdit') return
        // 🔴 與 panel.ts 同一條判準：版本對不上就丟掉並重送文件。
        if (m.baseVersion !== version) {
          log.rejected += 1
          window.postMessage({ type: 'document', uri: 'file:///probe.cpp', languageId: 'cpp', text: text, version: version }, '*')
          return
        }
        applySpan(m.span)
        version += 1
        log.accepted += 1
        window.postMessage({ type: 'applied', version: version }, '*')
      },
    }
  }
})()
