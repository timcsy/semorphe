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
export const EXTENSION_VERSION = '0.1.1'

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
    contributes: {
      viewsContainers: {
        activitybar: [
          {
            id: 'semorphe',
            title: DISPLAY_NAME,
            // 專案自己的 `<Σ>`——由建置腳本從 `public/logo.svg` 複製過來。
            //
            // ⚠️ **一個已知的外觀風險**：VSCode 的活動列圖示慣例是**單色**的
            //    （宿主會依主題／選取狀態重新上色），而 `logo.svg` 是彩色的
            //    （深藍底 ＋ 天藍與白的筆畫）。它**畫得出來**，
            //    但在某些主題下可能不如單色版清楚。
            //    → 真的不好看的話，換成 `favicon.svg` 或做一個單色版即可，
            //      而那是一行的事。**先照使用者指定的用。**
            icon: 'assets/logo.svg',
          },
        ],
      },
      views: {
        semorphe: [
          {
            id: 'semorphe.blocks',
            name: '積木',
            type: 'webview',
          },
        ],
      },
    },
  }
}
