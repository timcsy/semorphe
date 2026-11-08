/**
 * **規格消歧的並排畫面**（spec 218 US3）——c-bridge 第 1 課「讀進一串整數，印出最大的」宣告了兩種讀法（讀到 0 停／讀到結尾停）。
 * 學生交一支「讀到 0 停」的程式 → 畫面上兩欄並排、讀到 0 停那欄一致；點選它 → 重新整理後選擇還在，再執行就照它判。
 * ⚠️ 自動化瀏覽器不自動暖機——這裡自己呼叫 `warmUpChecker()`（同 judge-by-verdict）。
 */
import { test, expect, type Page } from '@playwright/test'
import { skipPredictionIfAsked, editsSettled, useAsSource } from './helpers'

/* eslint-disable @typescript-eslint/no-explicit-any */
const LESSON = 'c-bridge/01-同一份程式兩種說法'
const STUDENT = '#include <stdio.h>\nint main() {\n    int x, m = 0, first = 1;\n    while (1) {\n        scanf("%d", &x);\n        if (x == 0) {\n            break;\n        }\n        if (first || x > m) {\n            m = x;\n            first = 0;\n        }\n    }\n    printf("%d\\n", m);\n    return 0;\n}\n'

async function openTask(page: Page): Promise<void> {
  await page.goto(`/?lesson=${encodeURIComponent(LESSON)}&task=max`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction((want) => (window as any).__app?.currentLesson?.id === want, LESSON, { timeout: 30_000 })
  await page.waitForFunction(() => Boolean((window as any).__appReady), undefined, { timeout: 30_000 })
  await page.evaluate(() => (window as any).__app.warmUpChecker())
  await expect(page.locator('#status-check')).toHaveAttribute('data-state', 'ready', { timeout: 180_000 })
}

async function runWithInput(page: Page): Promise<void> {
  await page.evaluate((c) => (window as any).__app.codeView.setCode(c), STUDENT)
  await useAsSource(page, '程式碼')
  await editsSettled(page)
  await page.locator('#run-btn').click()
  await skipPredictionIfAsked(page)
  const box = page.locator('.console-inline-input')
  await expect(box).toBeVisible({ timeout: 30_000 })
  await box.fill('3 9 2 0')
  await box.press('Enter')
}

test('★ 兩種讀法並排、點選之後照它判、重新整理後選擇還在', async ({ page }) => {
  test.setTimeout(360_000)
  await page.addInitScript(() => { if (!sessionStorage.getItem('kept')) { localStorage.clear(); sessionStorage.setItem('kept', '1') } })
  await openTask(page)
  await runWithInput(page)

  const panel = page.locator('.console-disambiguation').last()
  await expect(panel).toBeVisible({ timeout: 120_000 })
  await expect(panel.locator('.console-disambiguation-col')).toHaveCount(2)
  await expect(panel.locator('[data-interpretation="zero"]')).toHaveClass(/consistent/)
  await expect(panel.locator('[data-interpretation="eof"]')).toHaveClass(/inconsistent/)
  await expect(panel.locator('[data-interpretation="eof"] .console-disambiguation-mismatch')).toContainText('你的')

  await panel.locator('[data-interpretation="zero"] .console-disambiguation-choose').click()
  expect(await page.evaluate(() => localStorage.getItem('semorphe-disambiguation'))).toContain('"zero"')

  await openTask(page)   // 重新整理：選擇要還在
  await runWithInput(page)
  const panel2 = page.locator('.console-disambiguation').last()
  await expect(panel2.locator('[data-interpretation="zero"]')).toHaveClass(/chosen/, { timeout: 120_000 })
  const verdict = page.locator('.console-verdict').last()
  await expect(verdict).toHaveClass(/passed/, { timeout: 60_000 })
  await expect(verdict.locator('.console-verdict-source')).toContainText('讀到 0 就停')
})
