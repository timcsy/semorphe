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

  // 🔴 **網址帶得動組態**——`?lesson=cpp-beginner/01-印出一句話`。
  //    老師給學生一條連結就開始上課，而**連結本身就是那個狀態**：
  //    換一台電腦，老師再貼一次；零後端、零帳號。
  //    （設計脈絡：`draft/2026-08-27-教案是一個宣告.md`）
  //
  // ⚠️ 這裡是**整個專案唯一讀 `location` 的地方**——核心那側吃的是字串。
  get querySearch(): string {
    return typeof window !== 'undefined' ? window.location.search : ''
  },

  /**
   * 網頁版自己畫全部——**而畫在哪裡分兩處**（2026-08-25 使用者拍板）。
   *
   * > 「**網頁版也照 §六 把 picker 移到狀態列，但是行動版可以另外設計**」
   *
   * `knowledge/draft/2026-08-24-版面與檔案.md` §六 的 slot 詞彙逐字：
   * `statusBar  語言 · 風格 · 同步狀態 · 目前主體`。
   *
   * 🔴 於是「工作階段的設定」離開積木那一區——與 IDE 那側是**同一個判準**，
   * 只是網頁版沒有外層 chrome，那條 footer 就是它的宿主狀態列。
   *
   * ⚠️ **行動版另有設計**：它本來就把選擇器搬進漢堡選單，而狀態列在窄螢幕
   * 是隱藏的——那條路徑不受這一格影響（`switchToMobile` 記的是「原本的父節點」，
   * 不是「工具列」）。
   */
  controlSurfaces: {
    picker: 'panelStatusBar',
    action: 'panelToolbar',
    indicator: 'panelStatusBar',
    // 主控台就是下方面板那一格——**網頁版沒有終端機可以交給它**。
    output: 'panelBottom',
    // 變數也在下方面板——**網頁版沒有第二個面板區可以放它**。
    inspector: 'panelBottom',
    // 🔴 **網頁版沒有分頁列**——那顆「程式碼 ▾／流程 ▾…」是這一格
    //    **唯一的**名字。它在這裡是必要的，不是重複。
    identity: 'panelToolbar',
  },
}
