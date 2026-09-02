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
import type { UnderstandingLayer } from '../core/view-host'
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

/**
 * **這個視窗畫哪一層**（2026-09-01）。
 *
 * 🔴 使用者：「我原本的期待是能不能**把面板都獨立出來**？」
 *
 * 在這個宿主裡，四層有三層早就是 IDE 原生的東西了：
 *
 * ```
 * 程式碼  IDE 的編輯器
 * 主控台  IDE 的終端機      （因為程式要讀 cin，唯讀的輸出格讓輸入沒有家）
 * 變數    IDE 的 panel 視圖
 * 積木＋流程                 ← 只剩這兩個擠在同一個 webview 裡
 * ```
 *
 * 而它們擠在一起的代價，使用者一次講了四句：面板不像面板、線拉不動、
 * 說是四格其實不是、選單分不出組。**四句的根都是「我們在一個已經有版面引擎
 * 的宿主裡，又帶了一個自己的版面引擎進去」。**
 *
 * 🟢 一個視窗一層之後，版面回到 IDE：拖到側邊、拆成兩欄、用它自己的分隔線
 * ——而使用者不必再學第二套。
 */
/**
 * 🔴 **`'state'` 拆成兩種**（2026-09-02，spec 171 第二刀）。
 *
 * 使用者看到「一個 SEMORPHE 分頁裡面又有我們自己的兩個分頁」之後：
 * 「我是希望主控台和變數可以**移到上面的 tab** 變成『Semorphe 主控台』、
 * 『Semorphe 變數』」——那是**兩個原生分頁**，於是這裡是兩種視圖。
 *
 * ⚠️ 而先前拍板的「一個 view 裡畫我們自己的兩個分頁」的理由（兩個
 * `WebviewView` 是兩個 context，會回到『被餵的薄視圖』那個形狀）**在這裡
 * 不成立**：那條規矩管的是**投影**，而主控台與變數是**執行的輸出**
 * ——一條資料流本來就只有一個源頭（見 `CodeView.onConsoleOut`）。
 */
export type VscodeViewKind = 'blocks' | 'flow' | 'console' | 'variables'

const LAYER_OF: Record<VscodeViewKind, UnderstandingLayer> = {
  blocks: 'space',
  flow: 'relation',
  // ⚠️ 兩種視圖**同一層**——它們是那一層的兩個分頁，不是兩層。
  console: 'state',
  variables: 'state',
}

/**
 * 一個「只畫一層」的 VSCode 宿主宣告。
 *
 * ⚠️ 除了 `layers` 之外**與預設的那一份逐格相同**——因為它們是同一個宿主，
 * 差別只有「這個視窗負責哪一層」。
 *
 * > **兩個視窗如果只差在「畫什麼」，那就只有那一格可以不一樣。**
 */
/**
 * **這一種視圖是不是文件的寫入者**（2026-09-02，spec 171 第三刀）。
 *
 * 使用者在 Arduino IDE 打字：「**為何這 hello 一直閃**？」——打進去的字出現
 * 一下就被換回裸骨架。
 *
 * 🔴 根因：主控台與變數那兩個視圖各自是一個**完整的 session**，於是它們也
 * 收文件、也 lift、也回寫 `applyEdit`。而它們那個視窗裡**沒有積木工作區**
 * ——樹是空的，產生出來的就是一份裸骨架，然後**寫了回去**。
 *
 * ```
 * 使用者打  cout << "hello"
 * 主控台視窗（樹是空的）→ 產生 int main(){return 0;} → 寫回去
 * → hello 不見了 → 其他視窗重新 lift → 使用者再打一次 → 又不見
 * ```
 *
 * ⚠️ 而它們**根本不需要那份文件**：它們畫的是執行的輸出（一條資料流），
 * 由主行程從跑程式的那個視窗轉送過來。
 *
 * > **一個不投影任何東西的視圖，不該是一個寫入者
 * > ——而讓它變成寫入者的，是「每個視窗都是完整的 session」這個便利。**
 *
 * 🟢 它與 `vscode-large-delete-guard` 守的是同一件事的兩端：那一條把後果從
 * 「檔案沒了」降成「這一次沒同步」，而這一條拿掉的是**產生那種寫入的來源**。
 */
export function isDocumentWriter(kind: VscodeViewKind): boolean {
  return kind === 'blocks' || kind === 'flow'
}

export function vscodeProfileFor(kind: VscodeViewKind): HostProfile {
  // 🔴 **每個視窗只畫它自己那一個分頁**（2026-09-02，spec 171 第二刀）。
  //
  //    `output`／`inspector` 投影到 `panelBottom` ＝「**我自己畫**」，
  //    投影到 `hostPanel` ＝「宿主那邊有一個視圖在畫，我只負責**把資料送過去**」。
  //
  // ⚠️ 而積木／流程兩種視窗**兩格都不畫**——它們是跑程式的那一邊，
  //    輸出經由主行程轉給 panel 區那兩個視圖。少了這一段，執行的輸出
  //    會畫在一個**沒有人看得到**的面板裡（它在那個 webview 裡沒有位子）。
  //
  // > **「誰畫它」與「誰產生它」在多視窗之後不再是同一個問題。**
  const surfaces = {
    ...vscodeProfile.controlSurfaces,
    output: kind === 'console' ? 'panelBottom' : 'hostPanel',
    inspector: kind === 'variables' ? 'panelBottom' : 'hostPanel',
  } as HostProfile['controlSurfaces']
  return { ...vscodeProfile, layers: [LAYER_OF[kind]], controlSurfaces: surfaces }
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

  /**
   * 🔴 **控制項全部投影到宿主**。
   *
   * 使用者 2026-08-25：「Style、語言等等我想要不放在現在這邊，
   * 因為放在現在這邊會進積木面板，這樣在 VSCode 不是很好」。
   *
   * ```
   * picker      → 狀態列    IDE 自己的語言／編碼就放在那裡，這是原生的位置
   * action      → 標題列    分頁自己的動作，不佔畫布
   * indicator   → 狀態列    同步三態（2026-08-25 已交付）
   * ```
   *
   * ⚠️ 於是面板裡**只剩工具箱與畫布**——而那才是它該是的東西。
   */
  controlSurfaces: {
    picker: 'hostStatusBar',
    action: 'hostTitleBar',
    indicator: 'hostStatusBar',
    // 🪦 **`hostTerminal` 退場**（2026-09-01）。
    //
    // 它當初的理由是：「終端機，不是 Output 面板——我們的程式會讀 `cin`，
    // 而一個唯讀的輸出格會讓『輸入』沒有家。」
    //
    // 🔴 而那句話的對手是 **VSCode 的 Output 面板**。面板獨立出來之後，
    //    主控台可以是**我們自己的一個 webview 面板**——它有輸入框，
    //    `cin` 有家。**前提換掉了，結論就不跟著成立。**
    //
    // 使用者 2026-09-01：「或許，semorphe 的主控台**不一定要用原生的**。」
    //
    // 換掉買到三樣：
    //
    // ```
    // ① `panel.ts` 裡 217 行（16%）與 7 個全域狀態退場
    //    ——其中一大半是在補「唯讀」這個坑：終端機開不起來 → 改開一個
    //      編輯器分頁 → 連編輯器都開不起來 → 還給面板，整條退路
    // ② 「兩個面板搶一台終端機，輸入該給誰」這個問題【整個消失】
    // ③ Theia 可攜性——`history/080` 逐字：「Theia 的 Webview 與 VSCode 的
    //    差異沒有逐項比對過」，而 pty 正是差異最大的地方之一
    // ```
    //
    // > **一條為了繞過某個限制而生的路，在限制消失之後不會自己消失
    // > ——它會變成「本來就這樣」。**
    // 🟢 **2026-09-02（spec 171）：那個 webview 現在住在宿主的 panel 區**
    //    ——與終端機／問題並排（`panel.ts` 的 `registerConsoleView`）。
    //    ⚠️ 投影值仍然是 `panelBottom`，而那句話是對的：**畫它的是我們自己**，
    //    宿主只提供那塊地。「這個宿主把主控台畫在哪」與「這個視窗要不要畫它」
    //    是兩個問題——後者問 `profile.layers`（見 `app-shell` 的 `hostDrawsConsole`）。
    output: 'panelBottom',
    // 🪦 `hostPanel` 同上退場。變數本來是一個**被餵的**薄視圖，
    //    有自己一份 `reportVariables` schema，而餵它的面板關掉之後
    //    **沒有人清它**——它停在最後一筆，看起來完全正常。
    //
    // > **一個必須被餵才畫得出來的視圖，它不是在投影。**
    inspector: 'panelBottom',
  },
}
