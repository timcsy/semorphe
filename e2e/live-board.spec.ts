/**
 * **暫停時的板子與改感測器輸入**（spec 185，重構階段 5d）——走真的 Cella 除錯工作階段（`cella-lang/dap` 的 `readEnv`／`setInput`）。
 *
 * ```
 * 讀 A0 決定 13 號腳亮不亮，中斷點設在 delay
 * ① 第一次停：硬體分頁「暫停中」、13 號腳 LOW（A0 預設不到 500）
 * ② 改 A0＝900、繼續 → 下一次停：13 號腳 HIGH
 * ```
 * ⚠️ Arduino 的除錯模組第一次要編（那一段由 JS 直譯器跑、狀態列說原因）——先跑到 Cella 接手。
 */
import { test, expect, type Page } from '@playwright/test'
import { freshApp, useAsSource, treeHas, pickTarget, setBreakpoint, lineNumberOf, selectMode } from './helpers'

/* eslint-disable @typescript-eslint/no-explicit-any */
const SKETCH = 'void setup() {\n    pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n    int v = analogRead(A0);\n    if (v > 500) {\n        digitalWrite(13, HIGH);\n    } else {\n        digitalWrite(13, LOW);\n    }\n    delay(100);\n}\n'
const runner = (page: Page) => page.locator('#status-runner')

test('暫停時看得到板子、改 A0 之後下一圈就照新的值走', async ({ page }) => {
  test.setTimeout(400_000)
  await freshApp(page)
  await pickTarget(page, 'arduino-uno')
  await page.evaluate(() => (window as any).__app.warmUpChecker())
  await expect(page.locator('#status-check')).toHaveAttribute('data-state', 'ready', { timeout: 180_000 })
  await page.evaluate((c) => (window as any).__app.codeView.setCode(c), SKETCH)
  await useAsSource(page, '程式碼')
  await treeHas(page, 'cpp:delay')
  await setBreakpoint(page, await lineNumberOf(page, 'delay(100)'))

  // 跑到 Cella 接手（除錯模組第一次在背景編；之間由 JS 跑，停下就按停止再試）
  const t = Date.now()
  await selectMode(page, 'debug')
  for (;;) {
    await expect(page.locator('.console-status')).toHaveText(/已暫停|Paused/, { timeout: 60_000 })
    if ((await runner(page).getAttribute('data-provider')) === 'cella') break
    expect(Date.now() - t, 'Cella 一直沒有接手').toBeLessThan(240_000)
    await page.locator('.debug-stop').click()
    await page.waitForTimeout(3000)
    await page.locator('#run-btn').click()
  }

  await page.locator('.bottom-tab-btn[data-tab-id="hardware"]').click()
  const panel = page.locator('.hardware-panel')
  await expect(panel).toContainText('暫停中')
  await expect(panel).toContainText(/腳 13\s+OUTPUT\s+LOW/)

  await page.locator('.hardware-input-value').fill('900')
  await page.locator('.hardware-set-input button').click()
  await page.locator('.debug-continue').click()
  await expect(panel).toContainText(/腳 13\s+OUTPUT\s+HIGH/, { timeout: 30_000 })
  await page.locator('.debug-stop').click()
  await expect(panel, '停止之後回到判決的那一份（不再是暫停中）').not.toContainText('暫停中')
})
