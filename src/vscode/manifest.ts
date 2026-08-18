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
export const PUBLISHER = 'semorphe'
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
export const EXTENSION_VERSION = '0.7.1'

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
    'semorphe.target': prop('目標——課程清單與風格的具名組合（如 cpp／arduino）', 'cpp-beginner'),
    'semorphe.topic': prop('課程清單。留空則跟著目標', null),
    'semorphe.style': prop('程式碼風格。留空則跟著目標', null),
    'semorphe.blockStyle': prop('積木外觀', 'default'),
    'semorphe.locale': prop('積木的語言', 'zh-TW'),
  }
}

export function buildManifest(): ExtensionManifest {
  return {
    name: EXTENSION_NAME,
    displayName: DISPLAY_NAME,
    description: '唯一真實，各式投影——在編輯器裡用積木看你的程式。',
    version: EXTENSION_VERSION,
    publisher: PUBLISHER,
    license: 'MIT',
    // 🟢 `^1.74.0` 已證實在 Arduino IDE 裡可用
    //    （`~/.arduinoIDE/deployedPlugins/` 底下兩個擴充都宣告這個範圍）。
    engines: { vscode: '^1.74.0' },
    categories: ['Visualization', 'Education'],
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
      ],
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
        'editor/title': [
          {
            command: 'semorphe.openBlocks',
            when: EDITOR_WHEN,
            group: 'navigation',
          },
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
