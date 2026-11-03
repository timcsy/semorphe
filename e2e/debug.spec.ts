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
  // ⚠️ 2026-11-03（spec 205 T008）：停在迴圈體裡時作用域有 `total` 與 `i` 兩個——Cella 照 C++ 的作用域列（JS 直譯器只列 `total`）。
  //    所以找名字是 total 的那一列，不假設只有一列。
  const totalRow = page.locator('.variable-table tr', { has: page.locator('.var-name', { hasText: /^total$/ }) })
  await expect(totalRow.locator('.var-value')).toHaveText('0')
})

test('斷點：沒設斷點時不會停', async ({ page }) => {
  // ⚠️ 反向。沒有它，一個「永遠停」的實作也能通過上面那支。
  await freshApp(page)
  await typeAndFormat(page, LOOP_PROGRAM)
  await selectMode(page, 'debug')

  await expect(page.locator('.console-output')).toContainText('6', { timeout: 20_000 })
})

test('加速：跳過整層——執行器問的是「跳過哪些節點」', async ({ page }) => {
  // ⚠️ 2026-08-12 把這段從四步積木 API 換成一句 `nodesInAncestorScope`，而當時沒驗到；2026-11-03 改成從語意樹算（`core/execution-scope.ts`）。
  await freshApp(page)
  await typeAndFormat(page, LOOP_PROGRAM)
  await selectMode(page, 'step')

  await expect(page.locator('.debug-toolbar')).toBeVisible({ timeout: 20_000 })
  // 先走進迴圈體——「在迴圈裡按加速，一次跳出整層」是這支的前提。
  // ⚠️ 2026-11-03（spec 205 T008）：原本固定按 4 下（JS 直譯器以敘述為單位，4 步剛好在迴圈裡）；
  //    Cella 以節點為單位，4 步還停在 `int total = 0` 的子節點——前提沒成立。改成走到變數面板出現 `i`（進了 for）為止。
  const iRow = page.locator('.variable-table tr', { has: page.locator('.var-name', { hasText: /^i$/ }) })
  for (let n = 0; n < 40 && (await iRow.count()) === 0; n++) {
    await page.locator('.debug-step').click()
    await page.waitForTimeout(200)
  }
  await expect(iRow, '走了 40 步還沒進到迴圈——前提沒成立，不是加速壞了').toHaveCount(1)
  await page.locator('.debug-accelerate').click()
  // 🔴 spec 183：加速跳出迴圈之後停在 `cout` **之前**（除錯器停在即將執行的那一顆）——再走一步才印出 6。
  //    在此之前單步是「先把整支跑完、錄下軌跡再重播」，輸出在第一步之前就全印了，
  //    這一行原本的斷言（加速之後就看得到 6）量到的是那個副作用，不是加速。
  await expect(page.locator('.console-output')).not.toContainText('6')
  // ⚠️ 2026-11-03（spec 205 T008）：Cella 的單步以**節點**為單位（`granularity: 'node'`），比 JS 直譯器的敘述細——
  //    跳出迴圈之後，`cout << total << endl` 要走幾個子節點才真的印出。所以「最多再走幾步」而不是「恰好一步」；
  //    仍然量得到加速：不加速的話三圈迴圈要走的步數遠多於這個上限。
  for (let i = 0; i < 8; i++) {
    if ((await page.locator('.console-output').innerText()).includes('6')) break
    await page.locator('.debug-step').click()
    await page.waitForTimeout(300)
  }
  await expect(page.locator('.console-output')).toContainText('6', { timeout: 20_000 })
})
