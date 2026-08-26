/**
 * **第七十七條護欄的行為那一半**：問人走頁面，而**測試按得到那個問句**。
 *
 * ## 為什麼這支非有不可
 *
 * 在此之前，「積木改過了要先同步嗎？」是一個 `window.confirm`，
 * 而 e2e 對它**零覆蓋**——`grep dialog|confirm e2e/` 一筆都沒有。
 *
 * > **那不是巧合：一個會凍住 Playwright 的東西，測試寫不下去。**
 *
 * ⚠️ 所以護欄的靜態那一半（`src/ui/` 不得呼叫 `confirm`）擋的是「長回來」，
 * 而這一支擋的是**「換了載體而那個問句其實按不到」**——
 * 兩種缺陷長得完全不一樣，缺一個都不算守住。
 *
 * ## ⚠️ 這支【不】驗什麼
 *
 * - **不驗同步的語義**（誰蓋誰、何時算 dirty）——那一刀只換載體，語義一個字沒改。
 * - **不驗 Esc 的行為**：今天 Esc ＝「就跑現在這一份」（與舊的 confirm 取消相同），
 *   而那是一個**刻意留著的可再談設計**（見 `execution-controller` 的 `askSyncBeforeRun`）。
 *   釘死它會讓「哪天決定改」變成改測試，而不是改設計。
 */
import { test, expect } from '@playwright/test'
import { freshApp, typeAndFormat, runButton } from './helpers'

test('★ 積木改過之後按執行 → 出現【頁內】的問句，而不是瀏覽器的對話框', async ({ page }) => {
  // 🔴 原生對話框會凍住這一支——所以先裝一個攔截器，
  //    它一旦被觸發就代表 `confirm()` 又長回來了。
  let nativeDialogFired = false
  page.on('dialog', async (d) => { nativeDialogFired = true; await d.dismiss() })

  await freshApp(page)
  await typeAndFormat(page, 'int main() { int x = 1; cout << x << endl; return 0; }')

  // 讓「積木改過了而還沒同步」成立——那是這個問句唯一的觸發條件。
  await page.evaluate(() => {
    ;(window as never as { __app: { blocksDirty: boolean } }).__app.blocksDirty = true
  })

  await runButton(page).click()

  const pick = page.locator('.quick-pick-overlay')
  await expect(pick, '🔴 按了執行而沒有出現頁內的問句').toBeVisible({ timeout: 5000 })
  await expect(page.locator('.quick-pick-item')).toHaveCount(2)

  // ★ 選「就跑現在這一份」——行為要與換載體之前逐字相同
  await page.locator('.quick-pick-item').filter({ hasText: /就跑現在這一份|Run what is here now/ }).click()
  await expect(pick).toHaveCount(0)
  await expect(page.locator('.console-panel, #console-panel')).toContainText('1', { timeout: 10_000 })

  expect(nativeDialogFired, '🔴 `window.confirm`／`prompt` 又長回來了').toBe(false)
})
