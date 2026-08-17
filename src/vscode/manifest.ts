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
 * @param version 由建置腳本從根 `package.json` 帶進來——⚠️ **不要在這裡再寫一次**，
 *                兩份版本號一定會漂移。
 */
export function buildManifest(version: string): ExtensionManifest {
  return {
    name: EXTENSION_NAME,
    displayName: DISPLAY_NAME,
    description: '唯一真實，各式投影——在編輯器裡用積木看你的程式。',
    version,
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
