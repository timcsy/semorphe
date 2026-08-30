/**
 * **執行的四條線，在真的渲染出來之後。**
 *
 * 每一支對應一件**在 DOM 之外驗不到**的事。判準見 `playwright.config.ts` 檔頭：
 * 驗得到就不要寫進這裡。
 */
import { test, expect, type Page } from '@playwright/test'
// ⚠️ 這支自己有一份 `freshApp`（見下），而同步選單那個觸發器共用 helpers 的
import { useAsSource } from './helpers'

/**
 * ⚠️ 專案把程式存在 localStorage，而**上一支測試的存檔會餵給下一支**。
 * 每支測試自己清乾淨——那是 `component-encapsulate` 步驟 1 的同一件事：
 * **先證明輸入是你以為的那個。**
 */
async function freshApp(page: Page): Promise<void> {
  await page.addInitScript(() => window.localStorage.clear())
  await page.goto('/')
  // 積木工作區出現 ＝ 應用真的起來了（而不是白畫面）
  await expect(page.locator('.blocklyWorkspace, .injectionDiv').first()).toBeVisible({ timeout: 30_000 })
}

/** 把程式碼打進 Monaco。⚠️ 用鍵盤而不是設值——設值不會觸發 code→blocks。 */
async function typeCode(page: Page, code: string): Promise<void> {
  // 🔴 **用 API 設值 ＋「以此為準：程式碼」，不用鍵盤做整份取代。**
  //
  // 2026-08-31 之前這裡是「click → Cmd+A → 打字」，而它**只在編輯器本來是空的
  // 時候成立**。開機不同步那一刀修好之後，第一次打開就有骨架，於是：
  //
  // ```
  // 選全 → 打第一個字元 → 整份被取代 → code→blocks 觸發
  //      → 積木還是舊的那棵 → 骨架回寫進來 → 剩下的字元打在它中間
  // ```
  //
  // 實測結果（兩輪，第二輪壞）：
  // `int main() {\n    return 0;\nint main() { int total = 0; ...`
  //
  // ⚠️ **加等待救不了它**：試過「先刪光 → 等 1.2 秒 → 再選一次 → 打」，
  //    兩輪裡仍然壞一輪——刪光之後程式碼**會自己回來**（網頁版沒有檔案，
  //    積木就是真相），而它回來的時機不固定。
  //
  // > **只要另一邊會自動回寫，用鍵盤做「整份取代」就不是原子的
  // > ——那不是等待長度的問題，是它中間必然有一瞬間是空的。**
  //
  // 🟢 而「用鍵盤才觸發得了 code→blocks」這個理由已經不成立：
  //    `useAsSource(page, '程式碼')` 就是那個觸發器，而且是明確的一次。
  await page.evaluate((c) => (window as never as { __app: { codeView: { setCode(s: string): void } } }).__app.codeView.setCode(c), code)
  await useAsSource(page, '程式碼')
  // 等 code→blocks 走完：積木出現
  await expect(page.locator('.blocklyDraggable').first()).toBeVisible({ timeout: 15_000 })
}

const loopProgram = 'int main() { int total = 0; for (int i = 1; i <= 3; i++) { total = total + i; } cout << total << endl; return 0; }'

test('程式碼 → 積木 → 執行輸出', async ({ page }) => {
  await freshApp(page)
  await typeCode(page, loopProgram)

  await page.locator('#run-btn').click()

  // 1+2+3 = 6
  await expect(page.locator('.console-output')).toContainText('6', { timeout: 20_000 })
})

test('狀態列的文字由視圖決定——執行器不再知道要顯示什麼字', async ({ page }) => {
  // ⚠️ 這一支釘的是 2026-08-12 那次重構的**行為契約**：
  // 執行器只廣播 `{ status, reason }`，文案／i18n 鍵／CSS class 全在視圖裡。
  // 若有人把文案搬回執行器，這支不會紅——但若 i18n 鍵漏了，它會。
  await freshApp(page)
  await typeCode(page, loopProgram)

  await page.locator('#run-btn').click()

  const status = page.locator('.console-status')
  await expect(status).toHaveText(/程式執行完畢|Program completed|Completed/, { timeout: 20_000 })
  // CSS class 是視圖自己加的（`completed`），不是執行器傳的
  await expect(status).toHaveClass(/completed/)
})

test('執行錯誤：訊息與狀態都由視圖決定樣式', async ({ page }) => {
  await freshApp(page)
  await typeCode(page, 'int main() { int v; v.push_back(1); return 0; }')

  await page.locator('#run-btn').click()

  const status = page.locator('.console-status')
  await expect(status).toHaveText(/錯誤|Error/, { timeout: 20_000 })
  // ⚠️ 執行器只送 `stream: 'stderr'`——**它不知道那會變紅**。
  await expect(status).toHaveClass(/error/)
})
