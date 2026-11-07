/**
 * **判題先問判決**（spec 200，重構階段 6b）——用題目宣告的測資跑，而不是學生這一次打的輸入。
 *
 * 第 04 課第一題要「讀一個數、印你打的是 N」，題目的測資是 7。學生執行時自己打了 5：
 * ```
 * 判決載好   → 用 7 跑 → 通過，並說「依判斷：用這一題的測資」
 * 判決不在   → 用他這一次的輸出（印 5）→ 還沒對，並說「依這一次執行的輸出」（lesson-pins 那一支走這條）
 * ```
 * ⚠️ 自動化瀏覽器不自動暖機——這裡自己呼叫 `warmUpChecker()`。
 */
import { test, expect } from '@playwright/test'
import { openLessonLink, skipPredictionIfAsked, editsSettled } from './helpers'

/* eslint-disable @typescript-eslint/no-explicit-any */
test('判決載好時，判題用題目的測資——學生打了別的輸入也判得對，並說出依據', async ({ page }) => {
  test.setTimeout(240_000)
  await page.addInitScript(() => window.localStorage.clear())
  await openLessonLink(page, 'cpp-beginner/04-讀進來')
  await page.evaluate(() => (window as any).__app.warmUpChecker())
  await expect(page.locator('#status-check')).toHaveAttribute('data-state', 'ready', { timeout: 180_000 })

  await page.locator('.monaco-editor').first().click()
  await page.keyboard.press('Control+Home')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('int x;\ncin >> x;\ncout << "你打的是 " << x << endl;', { delay: 10 })
  await editsSettled(page)
  await page.locator('#run-btn').click()
  await skipPredictionIfAsked(page)
  const box = page.locator('.console-inline-input')
  await expect(box).toBeVisible({ timeout: 30_000 })
  await box.fill('5')
  await box.press('Enter')

  const verdict = page.locator('.console-verdict').last()
  await expect(verdict).toHaveClass(/passed/, { timeout: 60_000 })
  await expect(verdict.locator('.console-verdict-source')).toContainText('依判斷')
})
