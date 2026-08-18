/**
 * 與宿主的**唯一接觸點**。
 *
 * ## 🔴 為什麼要有這個檔
 *
 * `acquireVsCodeApi()` **一個 Webview 只能呼叫一次** ——第二次會丟
 *
 * ```
 * An instance of the VS Code API has already been acquired
 * ```
 *
 * 而 2026-08-18 就是這樣壞的：`VscodeCodeView` 的建構子叫了一次，
 * 診斷那段又叫了一次。
 *
 * ## ⚠️ 而這個缺陷有一個特別討厭的性質：**預檢抓不到**
 *
 * Chromium 裡 `acquireVsCodeApi` 根本不存在，所以兩處都走
 * 「沒有宿主」的分支，**兩次都回 `null`，什麼事都不會發生**。
 *
 * > **一個「只有在真環境裡才存在的東西」，它的誤用也只有在真環境裡才會現形。
 * > 而模擬環境會把那個誤用【顯示成正常】。**
 *
 * 🔴 所以處置不是「小心不要叫兩次」，是**讓它只有一個地方叫得到**。
 */

declare function acquireVsCodeApi(): { postMessage(m: unknown): void }

export interface HostBridge {
  postMessage(m: unknown): void
}

/** ⚠️ 模組層級只求一次——而「求過了」由這個變數記住，不是靠呼叫端自律。 */
const bridge: HostBridge | null =
  typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null

/**
 * 送一則訊息給宿主。
 *
 * ⚠️ 沒有宿主時（Chromium 預檢）**靜靜地不做事**——
 * 🔴 而那是**刻意的**：預檢要的是「畫面對不對」，不是「訊息有沒有送到」。
 */
export function postToHost(m: unknown): void {
  bridge?.postMessage(m)
}

/** 現在有沒有宿主。⚠️ 預檢與真環境的差別，要說得出來而不是猜。 */
export function hasHost(): boolean {
  return bridge !== null
}
