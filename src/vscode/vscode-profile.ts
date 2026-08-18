/**
 * 這個宿主的宣告 —— **而它最重要的一格是「不記文件內容」**。
 *
 * ## 🔴 為什麼存檔服務要換掉
 *
 * `ui/app.ts` 的還原路徑今天是「開機 → 從存檔還原程式碼」。
 * 在網頁版那是對的（**存檔就是真相**）。
 *
 * 而在這裡**檔案才是真相** ——那條路徑會**用上一次的存檔蓋掉使用者的檔案**。
 *
 * ⚠️ **而處置不是「記得不要呼叫」** ——那是靠自律。
 *
 * > **讓它拿不到東西可還原，才是機制。**
 * > **一個「不會發生」的保證，如果只寫在註解裡，
 * > 它會在某次重構之後安靜地失效。**
 *
 * 🔴 由 `tests/integration/host-no-overwrite.test.ts` 釘住。
 */
import { VscodeCodeView } from './webview/vscode-code-view'
import type { HostProfile, StorageLike } from '../core/host/host-profile'
import type { SavedState, LoadOutcome } from '../core/storage'

/**
 * 不記文件內容的存檔服務。
 *
 * ```
 * save()   丟掉程式碼／語義樹／積木狀態，只留偏好類
 * load()   🔴 一律回「空」——因為【檔案才是真相】，沒有東西要還原
 * ```
 *
 * ⚠️ 「載不出來」還不夠：一份留在儲存體裡的程式碼，
 * **下一版的還原邏輯可能就把它撈出來了**。所以是**根本不存**。
 */
class DocumentlessStorage implements StorageLike {
  /** 只留偏好類的那幾格。⚠️ 而它今天沒有消費者——組態走宿主的設定系統。 */
  private prefs: Partial<SavedState> = {}

  save(state: Partial<SavedState>): boolean {
    const { blockStyleId, locale } = state
    // 🔴 **顯式列出要留的**，而不是「刪掉不要的」——
    //    後者在 `SavedState` 長出新欄位時會**預設洩漏**。
    this.prefs = { blockStyleId, locale }
    return true
  }

  loadOutcome(): LoadOutcome {
    // 🔴 一律空。理由見檔頭。
    return { kind: 'empty' }
  }

  dumpForTest(): unknown {
    return this.prefs
  }
}

export const vscodeProfile: HostProfile = {
  id: 'vscode',

  createCodeView(container: HTMLElement) {
    return new VscodeCodeView(container)
  },

  createStorage(): StorageLike {
    return new DocumentlessStorage()
  },

  // 🔴 關掉 ＝ **不建那些 DOM**，不是建了再藏起來（FR-006）：
  // > 一個長得一樣而按下去沒反應的按鈕，比沒有那顆按鈕更糟
  // > ——因為它讓「像」變成一個謊。
  features: {
    fileButtons: false,
    mobileLayout: false,
    codeKeyboard: false,
    codeEditorPane: false,
  },
  featureReasons: {
    fileButtons: '開檔／存檔／匯入匯出由 IDE 擔任——面板再放一份會有兩個「目前的檔案」',
    mobileLayout: '這個宿主是桌面應用，沒有行動版',
    codeKeyboard: '輔助輸入鍵盤要操作底層編輯器，而這裡的編輯器不歸我們管',
    codeEditorPane: '程式碼在 IDE 的編輯器裡——面板留一格空白給它只是浪費版面',
  },
}
