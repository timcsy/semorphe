/**
 * 積木面板——**一個編輯器區域的分頁，不是側邊欄的視圖**。
 *
 * ## 為什麼是 `createWebviewPanel` 而不是 `registerWebviewViewProvider`
 *
 * 使用者 2026-08-17（在側邊欄版本跑起來之後）：
 *
 * > 「我希望的**不是**像這種在 TreeView 上呈現，我是希望**放在一個 WebView**」
 *
 * ```
 * registerWebviewViewProvider   側邊欄的一格，寬度受活動列限制  ← 第一版
 * createWebviewPanel            編輯器區域的一個分頁，可並排    ← 現在
 * ```
 *
 * 🔴 **而後者才是這條路要的形狀**：積木面板最終要與**程式碼並排**
 * （`vision.md:116`：「VSCode 中 blocks = WebviewPanel、code = 原生 TextEditor」）
 * ——而側邊欄那一格擺不下兩欄。
 *
 * ⚠️ 放法參考 `../TextBlockly/`（**只參考放法**，使用者明說）：
 * 指令開啟 → 已存在就 `reveal`、不存在才建。
 * 🔴 而它的**內容**一律照 Semorphe，PoC 的解析器與架構一個字都不抄。
 *
 * ## 這個檔只負責算 URI 與接線
 *
 * HTML 與 CSP 住在 `webview-html.ts`——`vscode` 這個模組只在宿主行程裡存在，
 * **綁在一起就等於「只有開 IDE 才驗得了」**。
 */
import * as vscode from 'vscode'
import { csp, renderHtml } from './webview-html'

const VIEW_TYPE = 'semorphe.blocks'
const TITLE = 'Semorphe 積木'

/** 產出目錄裡的資源。與 `src/scripts/build-vscode.ts` 的佈局綁在一起。 */
const DIST = ['dist']
const MEDIA = ['dist', 'media']

/**
 * ⚠️ **單例。** 一個工作區只有一個積木面板。
 *
 * 🔴 那是**本輪刻意的簡化**，不是設計結論：`draft/2026-08-17-擴充的形狀.md`
 * 第二節數過 `App` 有 **18 個 per-document 欄位**，而多面板要先把那些分乾淨。
 * **本輪一個都不動**——所以只能有一個。
 */
let current: vscode.WebviewPanel | undefined

export function openBlocksPanel(context: vscode.ExtensionContext): void {
  // 並排在目前編輯器旁邊；沒有編輯器時就開在第一欄。
  const column = vscode.window.activeTextEditor
    ? vscode.ViewColumn.Beside
    : vscode.ViewColumn.One

  if (current) {
    current.reveal(column)
    return
  }

  current = vscode.window.createWebviewPanel(VIEW_TYPE, TITLE, column, {
    enableScripts: true,
    // ⚠️ 收起來再打開**不要重建**——重建等於重新載入 200 顆膠囊 ＋ 重新
    //    inject 畫布，而那會讓「順不順」量到的是啟動成本。
    retainContextWhenHidden: true,
    // 🟢 只要一個 root——Blockly 被 Vite 打包進 `webview.js`，
    //    不必像 PoC 那樣另外指 `node_modules/blockly`。
    localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, ...DIST)],
  })

  const webview = current.webview
  const uri = (...parts: string[]): string =>
    webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, ...parts)).toString()

  webview.html = renderHtml({
    scriptSrc: uri(...DIST, 'webview.js'),
    // ⚠️ **尾端斜線**：Blockly 直接把 `media` 當前綴接檔名，
    //    少一個 `/` 就變成 `.../mediasprites.png`——破圖但功能還在。
    mediaSrc: `${uri(...MEDIA)}/`,
    csp: csp(webview.cspSource),
  })

  current.onDidDispose(() => { current = undefined }, null, context.subscriptions)
}
