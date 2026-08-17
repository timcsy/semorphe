/**
 * Webview 面板——**只負責算 URI 與接線**。
 *
 * HTML 與 CSP 住在 `webview-html.ts`，理由寫在那個檔的檔頭：
 * `vscode` 這個模組只在宿主行程裡存在，**綁在一起就等於「只有開 IDE 才驗得了」**。
 */
import * as vscode from 'vscode'
import { csp, renderHtml } from './webview-html'

/** 產出目錄裡的資源。與 `src/scripts/build-vscode.ts` 的佈局綁在一起。 */
const DIST = ['dist']
const MEDIA = ['dist', 'media']

export class SemorphePanelProvider implements vscode.WebviewViewProvider {
  static readonly viewType = 'semorphe.blocks'

  // ⚠️ 顯式欄位 ＋ 指派，**不用建構子參數屬性**——專案開了
  // `erasableSyntaxOnly`（tsconfig），而參數屬性是「需要產生程式碼」的語法。
  //
  // 🔴 值得記的是**誰抓到它**：`npm test`（esbuild）與 `npm run build:vscode`
  //    （Vite）**兩個都放行**，只有 `npx tsc --noEmit` 叫。
  //    ——那就是把 `src/vscode/` 放在 `tsconfig` 的 `include` 裡買到的東西。
  private readonly extensionUri: vscode.Uri

  constructor(extensionUri: vscode.Uri) {
    this.extensionUri = extensionUri
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    view.webview.options = {
      enableScripts: true,
      // 🟢 本輪只要一個 root——Blockly 被 Vite 打包進 `webview.js`，
      //    不必像 PoC 那樣另外指 `node_modules/blockly`。
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, ...DIST)],
    }
    const webview = view.webview
    const uri = (...parts: string[]): string =>
      webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, ...parts)).toString()

    view.webview.html = renderHtml({
      scriptSrc: uri(...DIST, 'webview.js'),
      // ⚠️ **尾端斜線**：Blockly 直接把 `media` 當前綴接檔名，
      //    少一個 `/` 就變成 `.../mediasprites.png`——破圖但功能還在。
      mediaSrc: `${uri(...MEDIA)}/`,
      csp: csp(webview.cspSource),
    })
  }
}
