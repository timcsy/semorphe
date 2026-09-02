/**
 * **這個宿主的怪癖——唯一一處問「你是誰」的地方**（2026-09-02）。
 *
 * ## 🔴 這個專案明令禁止用身分猜能力，而這裡是一筆有病歷的例外
 *
 * 第六十三條護欄本來寫的是「`src/vscode/panel.ts` 裡不准出現
 * `vscode.env.appName`」，理由是**用身分猜能力**：宿主換版本、換名字，
 * 或第三個宿主出現時，那種判斷會安靜地錯。而正確的做法是**探測能力**。
 *
 * ⚠️ 而 2026-09-02 撞到兩件**探測不出來**的事（都查證過）：
 *
 * ```
 * ① 關得掉檔案那個分頁嗎
 *    tabGroups ✅  tabGroups.close ✅  TabInputText ✅   ← API 表面一模一樣
 *    而 Arduino IDE 上關不掉（使用者實測：「檔案沒有辦法關閉」）
 *
 * ② 答得出「panel 區那一頁現在開著嗎」嗎
 *    WebviewView.visible 回 true（而它是關的）
 *    document.hidden 也是 false（`retainContextWhenHidden`）
 *    ——兩個證人**同時**說謊，交集也救不了
 * ```
 *
 * > **能力探測問的是「你有沒有這個方法」，而這兩題問的是「你做了會怎樣」
 * > ——後者只有做過一次才知道。**
 *
 * 🟢 所以規則從「不准問身分」改成「**只准在這裡問**」：
 *
 * ```
 * ① 名單住在這一個檔，每一筆都要附【怎麼量到的】
 * ② 其餘每一個檔仍然不准出現 `vscode.env.appName`（第六十三條照舊擋）
 * ③ 而能探測的一律探測——這裡只收探測不出來的那幾筆
 * ```
 *
 * ⚠️ 而它們**都還有第二層**：實際做過之後量到失敗，就把能力關掉
 * （見 `panel.ts` 的 `swapWithEditor` 尾端）——名單是**起點**，不是結論。
 */
import * as vscode from 'vscode'

/**
 * 已知**關不掉檔案分頁**的宿主。
 *
 * 病歷：使用者 2026-09-02 在 Arduino IDE：「檔案沒有辦法關閉，所以我建議
 * 在 ArduinoIDE 這邊程式碼不是一個可切換的選項」。
 * ⚠️ 而「切換到程式碼」要靠「多開一份撐位子、再把多的關掉」（`swapWithEditor`）。
 */
const CANNOT_CLOSE_EDITORS = /arduino|theia/i

/**
 * 已知**答不出「panel 區那一頁開著沒有」**的宿主。
 *
 * 病歷：使用者 2026-09-02：「沒有面板卻還說隱藏」——兩個可見性訊號同時說謊。
 */
const CANNOT_OBSERVE_PANEL = /arduino|theia/i

/** 這個宿主叫什麼——⚠️ 只給診斷報表看，不給任何判斷用。 */
export const hostName = (): string => vscode.env.appName

/** 這個宿主換得動編輯器嗎（要關得掉多開的那一份）。 */
export const hostCanCloseEditors = (): boolean => !CANNOT_CLOSE_EDITORS.test(vscode.env.appName)

/** 這個宿主答得出「那兩頁現在開著沒有」嗎。 */
export const hostSeesPanelVisibility = (): boolean => !CANNOT_OBSERVE_PANEL.test(vscode.env.appName)
