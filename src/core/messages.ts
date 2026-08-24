/**
 * **訊息埠**——「這個鍵顯示什麼字」由宿主決定，核心與語言套件只會問。
 *
 * ## 為什麼需要它（2026-08-24，被一個 Node 專案逼出來的）
 *
 * `examples/bring-your-own-view/` 在 Node 裡建了一份出貨產物，一跑就爆：
 *
 * ```
 * Error: Dynamic require of "path" is not supported
 *   at node_modules/jsdom/lib/api.js
 *   at node_modules/blockly/core-node.js
 * ```
 *
 * 追下去是 `languages/python/pack.ts:18` 的 `import * as Blockly from 'blockly'`
 * ——**只為了讀 `Blockly.Msg`**。於是：
 *
 * > **載入一個語言 ＝ 載入整個 Blockly（連帶 jsdom）**，
 * > 而那個語言套件與積木沒有任何關係。
 *
 * ⚠️ 這與 `dynamic-dropdown-field` 那一半是**同一個病的兩個症狀**：
 * 語言套件為了兩件小事（查一個字、登記一個下拉來源）把整個視圖層拖進來。
 *
 * 沒有設來源時回 `fallback`——**那不是降級，那是預設的行為**：
 * 一個沒有 UI 的宿主本來就沒有翻譯表，而它要的是能跑，不是英文。
 */
type MessageSource = (key: string) => string | undefined

let source: MessageSource | null = null

/**
 * 宿主把翻譯表接上來。網頁版與擴充都指向 `Blockly.Msg`
 * （`i18n/loader.ts` 注入的就是那個物件）。
 */
export function setMessageSource(fn: MessageSource): void {
  source = fn
}

/** 查一個字。查不到就用呼叫端給的 fallback——**fallback 是必填的** */
export function msg(key: string, fallback: string): string {
  return source?.(key) || fallback
}

/** 測試用：拔掉來源（回到「沒有宿主」的狀態） */
export function resetMessageSource(): void {
  source = null
}
