/**
 * **硬體分頁與課文的腳位檢查**（spec 184，重構階段 5c）——走真的 Cella 判決，不 mock。
 *
 * ```
 * ① 板子目標上的閃燈 → 硬體分頁畫出 13 號腳三段亮（從 1、2002、4003 ms 開始）
 * ② 閃燈課「跟著做」：照課文寫 → 通過；delay(500) → 不通過，說得出第幾個事件、實際幾毫秒
 * ```
 * ⚠️ 自動化瀏覽器不自動暖機（`src/main.ts`）——這裡自己呼叫 `warmUpChecker()`。
 */
import { test, expect, type Page } from '@playwright/test'
import { freshApp, useAsSource, treeHas, pickTarget, openLessonLink, selectMode } from './helpers'

/* eslint-disable @typescript-eslint/no-explicit-any */
const BLINK = (ms: number) => `void setup() {\n    pinMode(LED_BUILTIN, OUTPUT);\n}\n\nvoid loop() {\n    digitalWrite(LED_BUILTIN, HIGH);\n    delay(${ms});\n    digitalWrite(LED_BUILTIN, LOW);\n    delay(${ms});\n}\n`

async function warm(page: Page): Promise<void> {
  await page.evaluate(() => (window as any).__app.warmUpChecker())
  await expect(page.locator('#status-check')).toHaveAttribute('data-state', 'ready', { timeout: 180_000 })
}

async function feed(page: Page, code: string): Promise<void> {
  await page.evaluate((c) => (window as any).__app.codeView.setCode(c), code)
  await useAsSource(page, '程式碼')
  await treeHas(page, 'cpp:digital_write')
}

test('板子上的閃燈：硬體分頁畫出 13 號腳的三段亮', async ({ page }) => {
  test.setTimeout(300_000)
  await freshApp(page)
  await pickTarget(page, 'arduino-uno')
  await warm(page)
  await feed(page, BLINK(1000))
  await page.locator('.bottom-tab-btn[data-tab-id="hardware"]').click()
  const highs = page.locator('.hardware-panel .hardware-high')
  await expect(highs).toHaveCount(3, { timeout: 60_000 })
  expect(await highs.evaluateAll((rs) => rs.map((r) => Number(r.getAttribute('data-t'))))).toEqual([1, 2002, 4003])
  await expect(page.locator('.hardware-end')).toContainText('OUTPUT')
})

test('閃燈課「跟著做」：照課文通過；delay(500) 不通過並指出第幾個事件', async ({ page }) => {
  test.setTimeout(300_000)
  await openLessonLink(page, 'arduino/01-閃一顆燈')
  await warm(page)

  await feed(page, BLINK(1000))
  await selectMode(page, 'run')
  await expect(page.locator('.console-verdict')).toHaveClass(/passed/, { timeout: 60_000 })

  await feed(page, BLINK(500))
  await page.locator('#run-btn').click()
  const verdict = page.locator('.console-verdict').last()
  await expect(verdict).toHaveClass(/not-yet/, { timeout: 60_000 })
  await expect(verdict).toContainText(/第 2 個事件.*1000.*501/)
})
