/**
 * **拆輪子的橫條——一面鏡子**（2026-09-08）。
 *
 * ## 🔴 為什麼要 e2e，而 happy-dom 那支不夠
 *
 * `tests/unit/ui/quick-pick-bar.test.ts` 驗的是「餵一個 `previewBar` 進去會畫出來」。
 * 而**使用者按得到的那條路**是：改一下程式 → 計數記下來 → 打開章節清單 →
 * 那一課的列上有一條橫條。中間三步都在 `app.ts`，而單元測試碰不到它們。
 *
 * ⚠️ 而全跑的 e2e 是 fresh storage——**沒有任何一課有計數，橫條不會出現**，
 * 所以那 300 多支裡沒有一支驗得到它。這一支專門補這個洞。
 */
import { test, expect } from '@playwright/test'
import { openLessonLink } from './helpers'

test('★ 改一下 → 章節清單裡這一課有一條橫條，而橫條上【沒有字】', async ({ page }) => {
  test.setTimeout(90_000)
  await page.addInitScript(() => window.localStorage.clear())
  await openLessonLink(page, 'cpp-beginner/02-記住資料')

  // 在程式碼那一邊改一下——那會記一次 code
  await page.locator('.monaco-editor').first().click()
  await page.keyboard.press('Control+End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('int extra = 1;', { delay: 10 })
  // 等同步把樹換掉（計數掛在 semantic:update 上）
  await page.waitForFunction(() =>
    (window as never as { __app?: { syncController?: { currentTree?: { children?: Record<string, unknown[]> } } } })
      .__app?.syncController?.currentTree?.children?.body !== undefined, undefined, { timeout: 20_000 })
  await page.waitForTimeout(800)

  // 打開章節清單
  await page.locator('.status-item-btn[data-control-id="lesson"]').click()
  const row = page.locator('.quick-pick-item[data-value="cpp-beginner/02-記住資料"]')
  await expect(row, '🔴 章節清單裡找不到這一課').toBeVisible({ timeout: 10_000 })

  const bar = row.locator('.quick-pick-bar')
  await expect(bar, '🔴 改過了而橫條沒出現——計數沒接上，或章節格沒畫它').toHaveCount(1)

  // 🔴 鏡子不說話：橫條裡零文字節點
  expect(await bar.textContent(), '🔴 橫條上有字——那是評語，不是鏡子').toBe('')
  // 而 title 只准是數字
  const title = (await bar.getAttribute('title')) ?? ''
  expect(title).toMatch(/^積木 \d+ · 程式碼 \d+$/)
  for (const w of ['還', '才', '只', '已經', '你', '太', '不夠']) {
    expect(title.includes(w), `🔴 title「${title}」帶了「${w}」`).toBe(false)
  }

  // 參照系寫的是課程，不是他
  await expect(row.locator('.quick-pick-desc')).toContainText('建議：')

  // 沒改過的課【沒有】橫條——「還沒開始」不該長得像「做了但沒東西」
  const untouched = page.locator('.quick-pick-item[data-value="cpp-beginner/05-算一算"] .quick-pick-bar')
  await expect(untouched, '🔴 沒改過的課也畫了橫條').toHaveCount(0)
  await page.keyboard.press('Escape')
})
