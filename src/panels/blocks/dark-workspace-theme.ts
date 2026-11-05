/**
 * 畫布的深色主題 —— **從 `blockly-panel.ts` 的 private 抽出來**（2026-08-17）。
 *
 * ## 為什麼要抽
 *
 * VSCode 擴充的 Webview 要與網頁版**同一個主題**。
 * 而它原本是 `BlocklyPanel` 的 private 方法，Webview 拿不到。
 *
 * ⚠️ **另一條路是「在 Webview 裡複製一份」——而那是這個專案付過學費的東西**：
 * `history/072` 的病歷是**兩條產出路徑，一條全綠而另一條安靜地錯了**。
 *
 * > **兩份會漂移的主題，症狀是「網頁版換了顏色而擴充沒換」
 * > ——而那不會有任何測試變紅。**
 *
 * ## ⚠️ 抽出來的過程本身是一個風險
 *
 * 這是 spec 139 裡**唯一動到網頁版程式碼**的一步，所以它
 * **單獨一個 commit、改完立刻跑全套**——讓它出問題時對得出來。
 *
 * 🔴 **內容一個字元都沒有改**：只是換了住的地方。
 */
import * as Blockly from 'blockly'

export function createDarkWorkspaceTheme(): Blockly.Theme {
  return Blockly.Theme.defineTheme('dark_scratch', {
    name: 'dark_scratch',
    base: Blockly.Themes.Classic,
    componentStyles: {
      workspaceBackgroundColour: '#1e1e1e',
      toolboxBackgroundColour: '#252526',
      toolboxForegroundColour: '#cccccc',
      flyoutBackgroundColour: '#2d2d2d',
      flyoutForegroundColour: '#cccccc',
      flyoutOpacity: 0.9,
      scrollbarColour: '#4a4a4a',
      scrollbarOpacity: 0.7,
      insertionMarkerColour: '#fff',
      insertionMarkerOpacity: 0.3,
    },
  })
}
