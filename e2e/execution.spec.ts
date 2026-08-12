/**
 * **執行的四條線，在真的渲染出來之後。**
 *
 * 每一支對應一件**在 DOM 之外驗不到**的事。判準見 `playwright.config.ts` 檔頭：
 * 驗得到就不要寫進這裡。
 */
import { test, expect, type Page } from '@playwright/test'

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
  const editor = page.locator('.monaco-editor').first()
  await editor.click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type(code)
  // 等 code→blocks 走完：積木出現
  await expect(page.locator('.blocklyDraggable').first()).toBeVisible({ timeout: 15_000 })
}

const 迴圈程式 = 'int main() { int total = 0; for (int i = 1; i <= 3; i++) { total = total + i; } cout << total << endl; return 0; }'

test('程式碼 → 積木 → 執行輸出', async ({ page }) => {
  await freshApp(page)
  await typeCode(page, 迴圈程式)

  await page.locator('#run-btn').click()

  // 1+2+3 = 6
  await expect(page.locator('.console-output')).toContainText('6', { timeout: 20_000 })
})

test('狀態列的文字由視圖決定——執行器不再知道要顯示什麼字', async ({ page }) => {
  // ⚠️ 這一支釘的是 2026-08-12 那次重構的**行為契約**：
  // 執行器只廣播 `{ status, reason }`，文案／i18n 鍵／CSS class 全在視圖裡。
  // 若有人把文案搬回執行器，這支不會紅——但若 i18n 鍵漏了，它會。
  await freshApp(page)
  await typeCode(page, 迴圈程式)

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
