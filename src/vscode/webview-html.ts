/**
 * Webview 的 HTML 與 CSP——**刻意不 import `vscode`**。
 *
 * ## 為什麼要獨立成一個檔
 *
 * `vscode` 這個模組**只在宿主行程裡存在**：測試環境解析不到它
 * （實測 2026-08-17：`Failed to resolve import "vscode"`）。
 *
 * 而這一刀有**兩個不會拋錯的失敗方式**都住在 HTML 裡：
 *
 * ```
 * ① media URI 少一個尾端斜線   → 縮放鈕／垃圾桶破圖
 * ② CSP 漏掉 img-src data:     → 積木上的 +／- 按鈕破圖
 * ③ 行內 <script>              → 畫布一片空白（被 CSP 擋掉）
 * ```
 *
 * > **把它們留在 `panel.ts` 裡，就等於「只有開 IDE 才驗得了」。
 * > 而一個只有開 IDE 才驗得了的東西，實務上等於沒有人驗。**
 *
 * 所以純函式住這裡，`panel.ts` 只負責算 URI。
 */

/**
 * CSP——**六條，而其中三條是「不加就會安靜地壞」**。
 *
 * ```
 * style-src … 'unsafe-inline'   Blockly 執行期注入樣式（Blockly.Css）
 * 🔴 img-src … data:            +／- 按鈕是 data URI
 * 🔴 connect-src …              Blockly 用 fetch() 抓音效
 * ```
 *
 * ### ① `style-src 'unsafe-inline'` —— **實測證實的，不是推論**
 *
 * 預檢頁第一版沒給它，Chromium 噴出五則
 * 「Applying inline style violates…」——**畫布因此連不上樣式**。
 *
 * ### ② `img-src data:`
 *
 * `ui/block-registrar.ts:291-305` 的 `+`／`-` 按鈕是
 * `'data:image/svg+xml,' + encodeURIComponent(...)`，而
 * `cpp_var_declare`／`cpp_print`／`cpp_array_declare`／`cpp_vector_declare`／
 * `cpp_initializer_list` 都用它。漏掉的症狀是**按鈕破圖而功能還在**。
 *
 * ### 🔴 ③ `connect-src` —— **2026-08-17 預檢實測撞出來的，而它是新的**
 *
 * Blockly **用 `fetch()` 載那三個 `.mp3`**（click／delete／disconnect），
 * 而 `connect-src` 沒設就 fallback 到 `default-src 'none'`：
 *
 * ```
 * Fetch API cannot load …/media/click.mp3.
 * Refused to connect because it violates the document's Content Security Policy.
 * PAGEERROR Failed to fetch
 * ```
 *
 * ⚠️ **`media-src` 擋不住它**——那條管的是 `<audio>`／`<video>` 元素，
 * 而 Blockly 走的是 `fetch` ＋ `AudioContext`。
 *
 * > **兩條看起來管同一件事的指令，管的其實是兩條不同的路。**
 *
 * PoC 沒遇過這一條（它沒有走到能出聲的地步），draft 也沒記過
 * ——**它是這一刀自己撞出來的**。
 *
 * ### `script-src` 為什麼用 cspSource 而不是 nonce
 *
 * nonce 管不到 ES module 的相依載入。
 * ⚠️ 而它的代價是**行內腳本一律不能用**——見 `renderHtml`。
 */
export function csp(source: string): string {
  return [
    `default-src 'none'`,
    // 🔴 `'wasm-unsafe-eval'` —— `code → blocks` 要在 Webview 裡跑 tree-sitter，
    // 而 `WebAssembly.compile` 沒有它會丟 **可被 catch 的 `CompileError`**
    // （2026-08-17 實測兩個方向：不加 → CompileError；加了 → 152 項匯出）。
    //
    // ⚠️ 它**嚴格窄於** `'unsafe-eval'`：只放行 WebAssembly 編譯。
    //
    // ## 為什麼是【現在】才加
    //
    // spec 138 撿到這個坑時刻意沒加，理由逐字：
    // 「**加一個還沒有人要用的權限，等於把它從『下一刀要處理的事』
    //   變成『已經在那裡、沒有人記得為什麼』**」。
    // 🟢 現在用到了，所以觸發條件成立。
    `script-src ${source} 'wasm-unsafe-eval'`,
    `style-src ${source} 'unsafe-inline'`,
    `img-src ${source} data:`,
    `media-src ${source}`,
    `connect-src ${source}`,
    `font-src ${source}`,
  ].join('; ')
}

export interface HtmlParts {
  scriptSrc: string
  /** 應用的樣式表——🔴 **與網頁版同一份**，這裡不另外做一套。 */
  styleSrc: string
  /** ⚠️ **必須以 `/` 結尾**——Blockly 直接把它當前綴接檔名。 */
  mediaSrc: string
  csp: string
  /**
   * 在主程式之前載入的腳本（**只有預檢頁在用**）。
   *
   * 🔴 為什麼需要它：`postToHost` 在沒有宿主時**靜靜地不做事**，
   * 於是預檢**驗不到「積木 → 程式碼」有沒有真的送出去**
   * ——而 2026-08-18 使用者回報的「沒同步」正是那個方向。
   *
   * > **一個把「沒送出去」顯示成正常的模擬環境，
   * > 驗得了畫面，驗不了接線。**
   *
   * ⚠️ 必須是**外部檔案**：CSP 沒有 nonce 也沒有 `unsafe-inline`，行內腳本不會執行。
   */
  preScripts?: string[]
}

const escapeAttr = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

export function renderHtml(parts: HtmlParts): string {
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${parts.csp}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Semorphe</title>
<link rel="stylesheet" href="${escapeAttr(parts.styleSrc)}">
<style>
  /* ⚠️ 只有【面板與整頁的差別】住在這裡——其餘的樣式與網頁版共用同一份。
     🔴 而這裡刻意【不】改任何顏色或間距：目標是「一樣」，不是「更好」。 */
  html, body { height: 100%; margin: 0; padding: 0; overflow: hidden; }
  #app { height: 100%; }
</style>
</head>
<body>
<!-- 🔴 **一個容器，其餘交給應用本身。**
     spec 139 這裡有 #canvas / #readout / #bar / #out ——那是一個【另做的東西】。
     而使用者要的是「像網頁版，只是文字編輯交給 IDE」，所以這裡與
     網頁版的 index.html 一樣：一個 #app。
     ⚠️ 註解裡不要用反引號——這整段住在一個樣板字串裡，
        反引號會把它切斷（2026-08-18 第二次踩到）。

     media 根走 data 屬性，不走行內 script：
     script-src 沒有 nonce 也沒有 unsafe-inline，所以行內腳本不會執行
     ——而症狀是「面板一片空白」，沒有任何錯誤指向這裡。 -->
<div id="app" data-blockly-media="${escapeAttr(parts.mediaSrc)}"></div>
${(parts.preScripts ?? []).map((s) => `<script src="${escapeAttr(s)}"></script>`).join('\n')}
<script type="module" src="${escapeAttr(parts.scriptSrc)}"></script>
</body>
</html>`
}
