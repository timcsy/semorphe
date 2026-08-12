/**
 * **除錯：斷點與加速。**
 *
 * ⚠️ 這支檔案存在的直接理由，是 2026-08-12 那一輪**手動驗不到的那兩件事**：
 * 斷點「命中時會停」與加速功能。而手動失敗的機制值得記下來，
 * 因為它就是 e2e 買到的東西——見 `helpers.ts` 的 `setBreakpoint`。
 */
import { test, expect } from '@playwright/test'
import { freshApp, typeAndFormat, lineNumberOf, selectMode, setBreakpoint, LOOP_PROGRAM } from './helpers'

test('斷點：設得上，而且執行會停在那裡', async ({ page }) => {
  await freshApp(page)
  await typeAndFormat(page, LOOP_PROGRAM)

  const line = await lineNumberOf(page, 'total = total + i')
  expect(line, '找不到迴圈體那一行 → 前置條件沒成立，不是被測的東西壞了').toBeGreaterThan(0)

  await setBreakpoint(page, line)
  // ⚠️ `selectMode` 這一下就開始執行了——見它的註解。
  await selectMode(page, 'debug')

  // ⚠️ 這一句釘的是「斷點反轉」：程式碼視圖把行號翻成 nodeId 推給執行器，
  // 執行器只比對 nodeId。翻譯錯了（0-based/1-based、區間）這裡就不會停。
  await expect(page.locator('.console-status')).toHaveText(/已暫停|Paused/, { timeout: 20_000 })

  // **停在對的地方**：第一次迭代之前，`total` 還是 0。
  //
  // ⚠️ 第一版這裡寫的是「主控台還沒印出 6」，而它**紅了**——
  // 因為除錯模式是**先跑完再回放**（`executeWithSteps` 預錄步驟），
  // 輸出在錄製時就全部產生了。
  //
  // > **「執行到哪裡」不能從輸出推——那是兩個時間軸。**
  //
  // 而這個錯誤假設只有 e2e 抓得到：單元測試裡沒有「主控台」這個東西。
  await expect(page.locator('.var-name')).toHaveText('total')
  await expect(page.locator('.var-value')).toHaveText('0')
})

test('斷點：沒設斷點時不會停', async ({ page }) => {
  // ⚠️ 反向。沒有它，一個「永遠停」的實作也能通過上面那支。
  await freshApp(page)
  await typeAndFormat(page, LOOP_PROGRAM)
  await selectMode(page, 'debug')

  await expect(page.locator('.console-output')).toContainText('6', { timeout: 20_000 })
})

test('加速：跳過整層——執行器問的是「跳過哪些節點」', async ({ page }) => {
  // ⚠️ 2026-08-12 把這段從四步積木 API 換成一句 `nodesInAncestorScope`，而當時沒驗到。
  await freshApp(page)
  await typeAndFormat(page, LOOP_PROGRAM)
  await selectMode(page, 'step')

  await expect(page.locator('.debug-toolbar')).toBeVisible({ timeout: 20_000 })
  for (let i = 0; i < 4; i++) await page.locator('.debug-step').click()
  await page.locator('.debug-accelerate').click()

  await expect(page.locator('.console-output')).toContainText('6', { timeout: 20_000 })
})
