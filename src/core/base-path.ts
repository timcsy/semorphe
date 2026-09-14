/**
 * **這個站掛在哪一個路徑底下。**
 *
 * ## 🔴 它為什麼存在（2026-09-14）
 *
 * 同一份程式要同時出現在兩個地方：
 *
 * ```
 * semorphe.com/        主線——e2e 綠了才更新
 * semorphe.com/next/   快車道——推上去就在，而它【不宣稱驗過】
 * ```
 *
 * 兩者**刻意同一個 origin**，理由只有一個而且它是硬的：
 *
 * > **`localStorage` 是 per-origin 的。** 換一個子網域，學生的存檔、進度、
 * > 作品**全部不在那裡**——而他不會知道，直到他回家打開主站看到一片空白。
 *
 * 而同一個 origin 的代價，就是這個檔：**每一條送到瀏覽器的絕對路徑
 * 都要帶著前綴**。少帶一條的症狀不是報錯，是**只有 `/next/` 那一邊 404**。
 *
 * ## 用法
 *
 * `BASE` 一定以 `/` 結尾（Vite 的 `BASE_URL` 契約），所以接的時候**不要再加斜線**：
 *
 * ```ts
 * `${BASE}lessons/`     ✅  →  /lessons/  或  /next/lessons/
 * `${BASE}/lessons/`    ❌  →  //lessons/
 * ```
 *
 * ⚠️ **這一支只管網頁版。** IDE 那一側的 webview 用的是 `vscode-webview://…`，
 * 而那裡根本沒有 `/lessons/`（`app-shell.ts` 已經把那顆連結藏起來）。
 */

/**
 * 站台前綴，永遠以 `/` 結尾。
 *
 * 🔴 **不要在別處直接讀 `import.meta.env.BASE_URL`**——那樣就有兩個地方
 * 知道這件事，而第二個地方會在有人改建置設定的那天悄悄不一致。
 * 唯一的例外是 `app-shell.ts` 的 Blockly media，它早於這個檔存在。
 */
export const BASE: string = ((): string => {
  // 瀏覽器／vitest：Vite 給的那一個說了算
  const vite = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL
  // ⚠️ node 端（`tools/build-lessons` 走 tsx）**沒有** `import.meta.env`
  //    ——課文靜態頁與 app 必須用同一個前綴，否則 `/next/` 那一份的
  //    「在編輯器打開」會把人送回主站。
  // ⚠️ 不用 `process` 這個名字——`src/` 的 tsconfig 沒有 node 的型別，
  //    而**加 `@types/node` 會讓核心從此看得見整個 node API**，那是反方向的。
  const g = globalThis as { process?: { env?: Record<string, string | undefined> } }
  const node = g.process?.env?.SITE_BASE
  const raw = vite ?? node ?? '/'
  if (raw === '') return '/'
  return raw.endsWith('/') ? raw : `${raw}/`
})()

/** 把一條**站內**路徑接上前綴。`p` 不帶開頭的斜線。 */
export function withBase(p: string): string {
  return `${BASE}${p.replace(/^\/+/, '')}`
}
