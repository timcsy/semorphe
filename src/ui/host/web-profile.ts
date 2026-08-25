/**
 * 網頁版的宿主宣告 —— 🔴 **它必須逐字等於今天的行為**。
 *
 * ## 這個檔存在的唯一理由
 *
 * 抽出 `HostProfile` 之後，網頁版也要有一份宣告。
 * ⚠️ 而它**不是一個機會去改善什麼**——這一刀的目標是
 * 「擴充裡跑的就是網頁版」，所以網頁版**一個像素都不能變**。
 *
 * > **一次為了支援新宿主而做的抽取，最容易的失敗方式
 * > 是「順手把舊的那個也改好一點」。**
 *
 * `history/072` 的病歷正是這種形狀：一條路徑全綠，而另一條安靜地錯了。
 */
import { MonacoPanel } from '../panels/monaco-panel'
import { StorageService } from '../../core/storage'
import type { HostProfile } from '../../core/host/host-profile'
import type { CodeView } from '../../core/host/code-view'

export const webProfile: HostProfile = {
  id: 'web',

  createCodeView(container: HTMLElement): CodeView {
    const panel = new MonacoPanel(container)
    panel.init(false)
    return panel
  },

  createStorage() {
    return new StorageService()
  },

  // 🟢 網頁版什麼都有——所以 `featureReasons` 是空的，
  // ⚠️ **而空是一份宣告，不是遺漏**：三個 feature 全開。
  features: {
    fileButtons: true,
    mobileLayout: true,
    codeKeyboard: true,
    codeEditorPane: true,
  },
  featureReasons: {},

  // 🔴 網頁版**自己畫全部**——這一張表就是今天的行為，一格都不能變。
  controlSurfaces: {
    picker: 'panelToolbar',
    action: 'panelToolbar',
    indicator: 'panelStatusBar',
  },
}
