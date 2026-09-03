import { CONTROLS, RUN_MODES, hostCommandId, runModeCommandId, surfaceOf } from '../core/host/controls'
// ⚠️ **建置期讀那份宣告**——「哪一顆畫在哪」只有一個真相（`vscode-profile`），
//    而這個檔是它的第二個消費者（第一個是 webview）。
import { vscodeProfile } from './vscode-profile'
/**
 * 擴充的宣告——**它是 TypeScript，不是一份散落的 JSON**。
 *
 * ## 為什麼不是 `src/vscode/package.json`
 *
 * `.vsix` 需要一份擴充自己的 `package.json`（根目錄那份是網頁版的）。
 * 三個放法：
 *
 * ```
 * (a) 加進根 package.json      🔴 汙染網頁版的宣告，而 vsce 會打包整個 repo
 * (b) src/vscode/package.json  ⚠️ src 底下的 .json 會被 5 條護欄掃到
 * (c) 這個檔                    🟢 是 TypeScript ⟹ 型別檢查得到、護欄看得到
 * ```
 *
 * > **宣告是程式碼的一部分，那就讓它受同一套檢查。**
 *
 * 由 `src/scripts/build-vscode.ts` 寫成 `build/vscode/package.json`。
 */

/** 擴充的識別——⚠️ 與網頁版的 `semorphe` 分開，兩者不是同一個東西。 */
export const EXTENSION_NAME = 'semorphe-vscode'
// 🔴 **發佈之後改不了。** 擴充 ID 是 `<publisher>.<name>`，換 publisher
// 等於換一個全新的擴充——安裝數、評價、使用者裝好的那一份全部歸零。
//
// 2026-08-31 上架前選的：`timcsy` 是既有的 publisher（TextBricks 掛在那裡），
// 而 `semorphe` 那個 ID 當時還沒被佔走。選既有的理由是零額外設定，
// 代價是市集上顯示為「Semorphe，作者 timcsy」而不是「Semorphe，Semorphe」。
export const PUBLISHER = 'timcsy'
export const DISPLAY_NAME = 'Semorphe'

/**
 * 🔴 **擴充有自己的版本號，而它與網頁版的無關。**
 *
 * ## 這一行是一個錯誤的直接產物（2026-08-17）
 *
 * 第一版讓建置腳本從根 `package.json` 帶版本號進來，理由寫的是
 * 「⚠️ 不要在這裡再寫一次，兩份版本號一定會漂移」。
 *
 * **那個理由是反的。** 後果當場出現：
 *
 * ```
 * 19:26  裝 v0.1.0（活動列圖示 = codicon）
 * 19:32  改成 logo.svg，重建、重裝 —— 版本【還是 0.1.0】
 * 結果   VSCode 活動列上仍然是 codicon
 * ```
 *
 * ⚠️ VSCode 以 **(id, version)** 認一個擴充。版本沒變 ⟹
 * 已經註冊的 `contributes`（活動列容器、視圖）**不會被重建**
 * ——而**檔案已經換掉了**，`package.json` 裡寫的也是新的。
 *
 * > **一個宿主用版本號決定「要不要重讀」的東西，
 * > 就不能拿一個不會變的數字當版本號。**
 *
 * 🔴 而它是今天第四個同族的東西：**改了、看起來沒改、而且不會報錯**。
 *
 * ## 所以：**改了 `contributes` 就要動這一行**
 *
 * ⚠️ 只改 `webview/` 底下的程式碼不必動——那是 Webview 的內容，
 * 每次開面板都重新載入。**只有 `contributes` 需要**。
 */
export const EXTENSION_VERSION = '0.14.0'

/**
 * 什麼時候出現入口——**副檔名【或】語言，兩個都要**。
 *
 * ## 🔴 為什麼不能只看副檔名（2026-08-17 使用者實測撞到）
 *
 * 使用者開了一個 `Untitled-1`、語言選 C++，而按鈕**沒出現**。
 * 那不是缺陷，是**條件寫窄了**：
 *
 * ```
 * URI              untitled:Untitled-1
 * resourceExtname  ""          ← 沒有副檔名
 * resourceLangId   "cpp"       ← 而語言是對的
 * ```
 *
 * ⚠️ 而 untitled buffer **正是主要場景之一**。使用者逐字（2026-08-17）：
 *
 * > 「甚至 **AI 給的 Code 他們貼上來**也是可以順利雙向轉換」
 *
 * **貼進來的第一站就是一個沒有副檔名的暫存分頁。**
 *
 * > **一個只認副檔名的條件，會漏掉「還沒存檔」這個最常見的起點。**
 *
 * ⚠️ `resourceExtname` **帶前面那個點**（`.cpp`，不是 `cpp`）；
 * 而 `resourceLangId` **不帶**（`cpp`）。兩者格式不同是 VSCode 的既定，
 * 不是筆誤。
 */
/**
 * 「目前這個分頁是 Semorphe 的某一個面板」。
 *
 * 🔴 **兩種都要算**（2026-09-01）。面板獨立出來之後有兩個 viewType，
 * 而標題列那些動作（執行／還原／清空／主控台…）對兩個**都成立**
 * ——它們作用在語義樹上，不在某一種投影上。
 *
 * ⚠️ 只寫 `semorphe.blocks` 的症狀是：站在流程面板上時，
 * **整條標題列的按鈕會消失**，而使用者讀到的不是「這裡沒有那顆按鈕」，
 * 是「壞了」。
 *
 * > **一個動作如果對每一種投影都成立，它的 `when` 就不能指名其中一種。**
 */
const PANEL_WHEN = [
  "activeWebviewPanelId == 'semorphe.blocks'",
  "activeWebviewPanelId == 'semorphe.flow'",
  "activeWebviewPanelId == 'semorphe.console'",
].join(' || ')

const EDITOR_WHEN = [
  ...['.ino', '.cpp', '.cc', '.cxx', '.c', '.h', '.hpp'].map(
    (ext) => `resourceExtname == ${ext}`,
  ),
  // `arduino` 是 Arduino IDE 認得的語言 id（`history/080`§一 查證過）；
  // 在純 VSCode 裡 `.ino` 多半被歸成 `cpp` 或 `plaintext`。
  ...['cpp', 'c', 'arduino'].map((lang) => `resourceLangId == ${lang}`),
].join(' || ')

export interface ExtensionManifest {
  name: string
  displayName: string
  description: string
  version: string
  publisher: string
  license: string
  engines: { vscode: string }
  categories: string[]
  keywords: string[]
  icon: string
  repository: { type: string; url: string }
  homepage: string
  bugs: { url: string }
  galleryBanner: { color: string; theme: 'dark' | 'light' }
  main: string
  activationEvents: string[]
  contributes: Record<string, unknown>
}

/**
 * 組態的宣告。
 *
 * 🔴 **每一項都要 `scope: "language-overridable"`** ——
 * 不宣告的話 `"[arduino]": { ... }` 那種語言覆寫**安靜地不生效**。
 *
 * ⚠️ 而那正是這個專案最常見的那一族缺陷：**改了、看起來沒改、而且不會報錯**。
 *
 * 教學場景是這一條的理由：一個班的目標該是**老師設一次進 workspace、
 * 進版控、學生可覆寫**，而 `.ino` 與 `.cpp` 可以不一樣。
 */
function configProperties(): Record<string, unknown> {
  const prop = (
    description: string,
    def: string | null,
  ): Record<string, unknown> => ({
    type: def === null ? ['string', 'null'] : 'string',
    default: def,
    description,
    // 🔴 少了這一行，語言覆寫不生效而且不出聲。
    scope: 'language-overridable',
  })
  return {
    // 🔴 **預設是 `null`，不是任何一個具名目標。**
    //
    // 2026-08-31 使用者：「我用 Arduino IDE 把 semorphe 開起來，
    // 原本的 `setup` 和 `loop` 會被 C++ 預設骨架覆蓋」。
    //
    // 這一格原本宣告 `'cpp-beginner'`——**而那不是一個目標，是一個課程清單的 id**
    // （登錄的目標是 `cpp`／`c`／`cpp-advanced`／`arduino`／`arduino-uno`／`esp32`…）。
    //
    // 認不得的 ID 在下游「回退到現況」而**不出聲**，於是目標停在 `cpp`，
    // C++ 的骨架把 `int main()` 接到使用者的 sketch 上。
    // 用預檢重現過（`tools/vscode-preflight`，把設定改成那個值就會紅）。
    //
    // ⚠️ **而 `sync/settings.ts:65` 早就診斷過同一個病、修好了 `DEFAULT_CONFIG`，
    //    卻沒有修這一份**——兩處寫著同一個預設值，而只有一處被修。
    //
    // > **一個預設值如果在兩個地方各寫一次，修好的那次不會把另一次帶走。**
    //
    // 🟢 `null` ⟹ `pick()` 落到 `defaultTargetForPath()`：`.ino`／`.pde` 自動選
    //    `arduino`，其餘落到 `cpp`。**那才是使用者要的行為，而且不必設定任何東西。**
    'semorphe.target': prop('目標（如 cpp／arduino）。留空則依副檔名自動判斷：`.ino` → arduino', null),
    'semorphe.topic': prop('課程清單。留空則跟著目標', null),
    'semorphe.style': prop('程式碼風格。留空則跟著目標', null),
    'semorphe.blockStyle': prop('積木外觀', 'default'),
    // 🔴 `follow-host` 是**一個值**——「跟隨 IDE 的顯示語言」。
    'semorphe.locale': prop('積木的語言（follow-host ＝ 跟隨 IDE）', 'follow-host'),
    // 🔴 **骨架與鷹架也要有家**（2026-09-01）。使用者：「為何出現的是
    //    Arduino 的？跟下面寫的不一樣啊」——工具箱是 Arduino（`target` 有存），
    //    而骨架寫著 C++ 標準骨架（**沒存，每個新面板回到預設**）。
    //
    // ⚠️ 在這個宿主裡存檔服務刻意什麼都不存（`DocumentlessStorage`——檔案才是
    //    真相），於是這些偏好本來**沒有家**。單例時代那只是「重開就沒了」；
    //    多面板時它變成三個面板各說各話。
    'semorphe.skeleton': prop('骨架（如 main／none／arduino）。留空則跟著目標', null),
    'semorphe.scaffold': prop('骨架怎麼顯示：hidden／ghost／full', null),
  }
}

export function buildManifest(): ExtensionManifest {
  return {
    name: EXTENSION_NAME,
    displayName: DISPLAY_NAME,
    // 🔴 **這一行是市集清單上名字底下那一句**，而它也進搜尋索引。
    //
    // 2026-08-25 網頁標題從「唯一真實，各式投影」換掉時，使用者的理由是
    // 「不然很黑話」——而**同一句話還留在這裡**，也就是留在對外的那一面。
    // 專案內部的公理與對外的第一句話是兩個讀者。
    description: '同一支程式，三種看法——程式碼、流程圖、積木，改哪一邊都算數。',
    version: EXTENSION_VERSION,
    publisher: PUBLISHER,
    license: 'MIT',
    // 🟢 `^1.74.0` 已證實在 Arduino IDE 裡可用
    //    （`~/.arduinoIDE/deployedPlugins/` 底下兩個擴充都宣告這個範圍）。
    engines: { vscode: '^1.74.0' },
    categories: ['Visualization', 'Education'],
    // 🔴 **市集的搜尋只吃 `keywords` 與 `description`／`displayName`。**
    //
    // 2026-08-31 上架前量到的：這個欄位**一個字都沒有**，
    // 而使用者搜「積木」「blockly」「視覺化程式」一個都找不到我們
    // ——擴充在市集上「存在」與「找得到」是兩件事。
    //
    // ⚠️ 上限 **5 個**（vsce 只送前 5 個，多的靜靜地丟掉），
    //    所以這五個是選出來的，不是列出來的。
    //
    // 🔴 **而「選出來」的判準是量到的排名，不是這個詞聽起來對不對。**
    //    0.11.0 上架後實測（`extensionquery` API，filterType 10）：
    //
    //    ```
    //    積木          共 1 筆 → 第 1 名
    //    視覺化程式     共 1 筆 → 第 1 名
    //    block-based  共 11 筆 → 第 2 名
    //    blockly      共 16 筆 → 第 16 名
    //    flowchart    共 40 筆 → 🔴 排不進前 40（被 mermaid／draw.io 那批佔滿）
    //    ```
    //
    //    > **一個排不進前 40 的關鍵字，與沒有填是同一件事
    //    > ——而它還佔掉了那五格的其中一格。**
    //
    //    換上 `圖形化程式`（實測競爭者 **0**，且那是 108 課綱的用詞
    //    ——老師搜的是這個）。⚠️ 中文詞幾乎沒有競爭，這是量出來的，
    //    不是猜的：`程式教學`／`拖曳`／`積木程式` 都是 0。
    keywords: ['積木', '圖形化程式', '視覺化程式', 'blockly', 'block-based'],
    // 擴充圖示——**與指令圖示是兩回事**（那些是 `contributes.commands[].icon`）。
    // 它自帶深色圓角底，所以市集的淺色／深色兩種佈景都看得清楚。
    icon: 'assets/icon.png',
    repository: { type: 'git', url: 'https://github.com/timcsy/semorphe.git' },
    homepage: 'https://semorphe.com/',
    bugs: { url: 'https://github.com/timcsy/semorphe/issues' },
    galleryBanner: { color: '#1e293b', theme: 'dark' },
    main: './dist/extension.js',
    // ⚠️ **不用 `onLanguage:arduino`**：那要開了 `.ino` 才啟動。
    //    本輪要驗的是「面板打不打得開」，**啟動條件愈少變因愈少**。
    //    `history/080`§一：textbricks 用的就是 onStartupFinished，而它載得起來。
    activationEvents: ['onStartupFinished'],
    // 🔴 **不是側邊欄的視圖，是編輯器區域的一個分頁。**
    //
    // 使用者 2026-08-17（在側邊欄版本跑起來之後）：
    // 「我希望的**不是**像這種在 TreeView 上呈現，我是希望**放在一個 WebView**」
    //
    // 於是 `viewsContainers` ＋ `views` 整組拿掉，換成一個指令
    // ——面板由 `vscode.window.createWebviewPanel` 建（見 `panel.ts`）。
    //
    // ⚠️ 而那讓活動列圖示（CSS 遮罩）那條**不再適用**：
    //    指令圖示是**當圖片**渲染的，並且依主題在 light/dark 之間切換。
    //    **兩種機制，兩種需求**——所以下面是兩個檔，不是一個。
    contributes: {
      commands: [
        {
          command: 'semorphe.openBlocks',
          title: '開啟積木面板',
          category: DISPLAY_NAME,
          icon: { light: 'assets/logo-light-theme.svg', dark: 'assets/logo-dark-theme.svg' },
        },
        // 🔴 **一種投影一個指令**（2026-09-01）。使用者：「我原本的期待是
        //    能不能把面板都獨立出來？」——獨立的意思包含「各自開得起來」。
        //    ⚠️ 沒有 `icon`：標題列上一顆圖示夠了，兩顆長得像的反而難認。
        {
          command: 'semorphe.openFlow',
          title: '開啟流程面板',
          category: DISPLAY_NAME,
        },
        // 🔴 **一個註冊了卻沒有宣告在這裡的指令，使用者按不到。**
        //
        // `semorphe.showDiagnostics` 從 spec 140 起就在 `extension.ts` 裡
        // `registerCommand` 了，而它**不在指令面板上**——於是 2026-08-19
        // 使用者回報同步異常時，唯一的現場紀錄（寫入歷程、鏡像對帳次數）
        // **沒有人拿得到**。
        //
        // > **一個拿不到的儀器，與一個不存在的儀器，在出事的那天是同一件事。**
        {
          command: 'semorphe.showDiagnostics',
          title: '顯示同步診斷',
          category: DISPLAY_NAME,
        },
        // 🔴 同步的入口在**宿主的 chrome** 上：狀態列點一下、或從這裡叫。
        //    使用者 2026-08-25：「全域，**不放在面板裡面的**」。
        {
          command: 'semorphe.showConsole',
          // 🪦 2026-09-01 之前這一顆叫出的是**終端機**；現在它開的是
          //    `state` 面板（主控台／變數兩個分頁）——名字跟著說實話。
          title: '開啟主控台面板',
          category: DISPLAY_NAME,
        },
        {
          command: 'semorphe.syncMenu',
          title: '同步：暫停／以哪一邊為準',
          category: DISPLAY_NAME,
        },
        // 🔴 **控制項的指令由登錄表產生**（`core/host/controls.ts`）。
        //
        // 使用者 2026-08-25：「Style、語言等等我想要不放在現在這邊，
        // 因為放在現在這邊會進積木面板，這樣在 VSCode 不是很好」。
        //
        // ⚠️ 手寫這一段的話，「有哪些控制項」就會有第二個真相
        // ——而這個檔案是**建置期**執行的，登錄表 import 得進來。
        ...CONTROLS
          // 🔴 **問表面，不問種類**（2026-09-02）：`action` 這一類裡，有的留在
          //    標題列（執行），有的搬進面板（還原／清除），有的整個退場。
          //    ⚠️ 只有**宿主自己畫**的那些才需要一顆指令。
          .filter((c) => (c.kind === 'picker' || c.kind === 'action')
            && surfaceOf(c, vscodeProfile.controlSurfaces).startsWith('host'))
          .map((c) => ({
            command: hostCommandId(c.id),
            title: c.hostTitle,
            category: DISPLAY_NAME,
            ...(c.icon ? { icon: c.icon } : {}),
          })),
        // 執行模式各自一個指令——**那正是 ▷ 下拉的做法**。
        ...RUN_MODES.map((m) => ({
          command: runModeCommandId(m.id),
          title: `執行：${m.label}`,
          category: DISPLAY_NAME,
        })),
      ],
      // 🔴 **`viewsContainers.panel` ＋ 一個 webview 視圖回來了**（2026-09-02，
      //    spec 171）——而**理由與 2026-09-01 拿掉它的那次不同**。
      //
      //    拿掉的理由是「變數在那裡是一個**被餵的**薄視圖」（它有自己一份
      //    `reportVariables` schema，餵它的面板關掉之後沒有人清它）。
      //    🟢 而現在住進去的**不是**薄視圖：是**與網頁版逐格相同的那一份**
      //    主控台（`ui/panels/console-panel.ts`），跑在我們自己的 webview 裡
      //    ——它有輸入框，`cin` 有家；它自己 lift 那份文件，不必被餵。
      //
      //    使用者 2026-09-02：「把我們的主控台跟原生的綁在一起，就是**多塞幾個
      //    tab**，而不是走編輯視窗」。
      //
      // ⚠️ **一個容器一個視圖**，而不是兩個並排的 native 分頁：兩個
      //    `WebviewView` 是**兩個 context**，那會回到「被餵的薄視圖」那個形狀。
      //    主控台／變數在那一個 webview 裡是**我們自己的兩個分頁**
      //    ——與網頁版逐字相同。
      //
      // > **與宿主一致、與自己一致，第一次指向同一邊。**
      // ⚠️ **兩個容器各一個視圖，不是一個容器裝兩個**：在 panel 那一排上，
      //    **一個容器就是一個分頁**，而使用者要的正是那一排上的兩個名字
      //    （2026-09-02 逐字：「移到上面的 tab 變成『Semorphe 主控台』、
      //    『Semorphe 變數』」）。
      //
      // 🪦 而先前拍板的「一個 view 裡畫我們自己的兩個分頁」的理由——
      //    「兩個 `WebviewView` 是兩個 context，會回到『被餵的薄視圖』那個形狀」
      //    ——**在這裡不成立**：那條規矩管的是**投影**，而主控台與變數是
      //    **執行的輸出**（三維錨定：屬於情境，`history/198`）。
      //    一條資料流本來就只有一個源頭，由主行程轉送。
      //
      // > **「不要被餵」是投影的規矩；資料流被餵是它的定義。**
      viewsContainers: {
        panel: [
          { id: 'semorphe-console', title: 'Semorphe 主控台', icon: 'assets/logo-dark-theme.svg' },
          { id: 'semorphe-variables', title: 'Semorphe 變數', icon: 'assets/logo-dark-theme.svg' },
        ],
      },
      views: {
        // 🔴 id 與 `panel.ts` 的 `PANEL_VIEW_IDS` **逐字相同**（預檢會出聲）
        'semorphe-console': [{ id: 'semorphe.consoleView', name: '主控台', type: 'webview' }],
        'semorphe-variables': [{ id: 'semorphe.variablesView', name: '變數', type: 'webview' }],
      },
      // 🪦 **舊的 `viewsContainers` ＋ `views`（2026-09-01 退場的那一組）**：
      //
      // 這裡曾經宣告一個 `panel` 區的容器與 `semorphe.variables` 視圖
      // ——那是「主控台去終端機、變數去 panel 區」那個時代的東西。
      //
      // 🔴 而變數在那裡是一個**被餵的**薄視圖：它有自己一份 `reportVariables`
      //    schema，而餵它的面板關掉之後**沒有人清它**，它停在最後一筆，
      //    看起來完全正常。
      //
      // > **一個必須被餵才畫得出來的視圖，它不是在投影。**
      //
      // 🟢 主控台與變數現在是 `state` 面板（`semorphe.console`）裡的兩個分頁
      //    ——與網頁版**逐格相同的那一份**，而它們各自跟著自己的面板走。
      configuration: {
        title: DISPLAY_NAME,
        properties: configProperties(),
      },
      menus: {
        // ⚠️ **`when` 用等號列舉，不用 `=~` 正則。**
        //
        // 第一版寫 `resourceExtname =~ /\.(ino|cpp|...)$/`，而使用者回報
        // 「指令看得到，按鈕與右鍵選單都沒有」。
        // 檢查過的：manifest 正確、圖示檔在、擴充 19:59:59 啟動成功、零錯誤
        // ——**所以問題不在載入**。
        //
        // 正則沒有被證明是錯的，⚠️ **而它是這裡唯一沒被證明是對的東西**。
        // 換成等號列舉是**把變因拿掉**，不是「修好了」。
        //
        // > **當一個東西不會出聲，先拆掉沒被驗過的那一塊，
        // > 不是先替沒被驗過的那一塊辯護。**
        // 🔴 **面板自己的標題列**——動作住在這裡，不佔畫布。
        //
        // ⚠️ `when` 用 `activeWebviewPanelId`：這些指令只在積木面板是
        // 目前分頁時才成立，**而它們對一般的編輯器沒有意義**。
        'editor/title': [
          {
            command: 'semorphe.openBlocks',
            when: EDITOR_WHEN,
            group: 'navigation',
          },
          ...CONTROLS
            // ⚠️ 執行有自己那一組（`editor/title/run`），其餘只留**宿主畫的**。
            .filter((c) => c.id !== 'run'
              && surfaceOf(c, vscodeProfile.controlSurfaces) === 'hostTitleBar')
            .map((c, i) => ({
              command: hostCommandId(c.id),
              when: PANEL_WHEN,
              // 🔴 **順序要寫出來**（2026-09-02）。使用者：「應該是還原在左、
              //    重做在右吧」——而畫面上是反的。
              //
              //    只寫 `navigation` 的話，同一群裡的先後**由宿主決定**
              //    （它不保證照宣告的順序），於是 ↩↪ 的方向會不一樣。
              //
              // > **一個「順序有意義」的清單，如果沒有把順序寫進去，
              // > 那個意義就交給了別人的實作細節。**
              //
              // ⚠️ `@1` 起跳：`openBlocks` 佔 `navigation`（沒有序號＝最前）。
              group: `navigation@${i + 1}`,
            })),
        ],
        // 🔴 執行是**一顆按鈕 ＋ 一個下拉**（人拍板：「像 C/C++ 的 VSCode 外掛那樣」）。
        //
        // ⚠️ `editor/title/run` 就是那個長相：群組裡多於一個指令時，
        // VSCode 畫成 ▷ 加一個 ▾。
        // 🔴 **而它本來是給編輯器分頁的**——它在 webview 分頁上、以及在
        // Theia 裡的行為**沒有被證明過**。退路是把整組移到 `editor/title`。
        // 由使用者在 Arduino IDE 裡人工按一次（`ship-extension` 第 7 步）。
        // 🔴 主控台要**一鍵到得了**——⚠️ 而它不是控制項登錄表的一員
        //    （`output` 是一條資料流，不是一顆按鈕），所以在這裡具名接。
        'editor/title/run': [
          { command: hostCommandId('run'), when: PANEL_WHEN, group: 'navigation@1' },
          { command: 'semorphe.showConsole', when: PANEL_WHEN, group: 'semorphe@0' },
          ...RUN_MODES.map((m, i) => ({
            command: runModeCommandId(m.id),
            when: PANEL_WHEN,
            group: `semorphe@${i + 1}`,
          })),
        ],
        'editor/context': [
          {
            command: 'semorphe.openBlocks',
            when: EDITOR_WHEN,
            // ⚠️ 用標準群組名。自訂群組（原本寫 `semorphe`）排序未定義，
            //    而那是另一個沒被驗過的東西。
            group: 'navigation',
          },
        ],
        // 檔案總管的右鍵——⚠️ 這裡的變數是 `resourceExtname` 沒錯，
        //    但它作用在**被點的那個檔**，不是編輯器裡的那個。
        'explorer/context': [
          {
            command: 'semorphe.openBlocks',
            when: EDITOR_WHEN,
            group: 'navigation',
          },
        ],
      },
    },
  }
}
