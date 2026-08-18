/**
 * 擴充的主行程進入點。
 *
 * ## 🔴 這個檔為什麼在 `src/` 底下
 *
 * 不是為了整齊，是為了**被檢查**：`tsconfig` 的 `"include": ["src"]`，
 * 而 6 條護欄 ＋ 1 個共用 helper 用 `listSourceFiles('src')` 掃這裡。
 *
 * > **把新程式碼放在護欄看不到的地方，等於替它辦一張免檢證。**
 *
 * ⚠️ 而它有一個**立刻生效**的後果，那是設計指引不是負擔：
 * 第二十八條護欄（膠囊就近性）反向也問「資料夾裡的東西都屬於這顆元件嗎」，
 * 所以 **`src/vscode/` 底下不得出現任何 conceptId 字串**。
 * 於是「畫布上那顆積木必須從登錄表挑」從一句規格變成一條會紅的檢查。
 *
 * 🟢 而它當場付過一次回報：`erasableSyntaxOnly` 抓到一個建構子參數屬性，
 * 而 `npm test`（esbuild）與 `npm run build:vscode`（Vite）**兩個都放行**。
 *
 * ## 這一層認識具體的宿主，而那是對的
 *
 * `src/vscode/` **不在** `NEUTRAL_DIRS`（`src/core`／`src/ui`／
 * `src/interpreter`／`src/views`）——中立性護欄管的是「核心不得認識宿主」，
 * 而**宿主層本來就要認識宿主**。方向是單向的。
 */
import * as vscode from 'vscode'
import { openBlocksPanel, requestDiagnostics } from './panel'

export const OPEN_COMMAND = 'semorphe.openBlocks'
export const DIAGNOSTICS_COMMAND = 'semorphe.showDiagnostics'

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(OPEN_COMMAND, () => openBlocksPanel(context)),
    // 🔴 診斷是一個**指令**，不是面板上的一塊——見 `panel.ts` 的 `OUTPUT`。
    vscode.commands.registerCommand(DIAGNOSTICS_COMMAND, () => requestDiagnostics()),
  )
}

export function deactivate(): void {
  // 沒有要清理的東西——本輪不持有任何跨面板狀態。
  //
  // ⚠️ 這是**顯式的空**，不是忘了寫：面板的生命週期由 `context.subscriptions`
  // 與 `onDidDispose` 管，而擴充本身不存檔、不開連線、不註冊計時器。
  // 下一刀（雙向同步）會讓這裡長出東西。
}
