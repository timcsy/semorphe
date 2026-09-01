/**
 * **手拖的佈局要活得過一次重新整理**——路線圖那條驗收的後半。
 *
 * ## 存的是【鑰匙】不是 `nodeId`
 *
 * `generateId()` 是 `node_${++counter}_${Date.now()}`——重開之後一個 id 都不會留
 * （實測「改一行不相干的程式碼，id 相同數 0」）。所以 `SavedState.flowLayout`
 * 存的是那顆節點的三把鑰匙（內容／行號／路徑），還原時用同一支配對器對回去
 * （`core/flow/layout-key.ts` 的 `matchByKeys`——與編輯時**共用同一份實作**）。
 *
 * ## ⚠️ 這支不檢測什麼
 *
 * - **不檢測配對是不是配到【對的那一顆】**——那由 `tests/unit/core/flow-layout-key.test.ts` 釘
 * - **不檢測跨檔案**（`檔案 × 面板種類` 的 key）——那要 `FileStore` 先存在
 * - ⚠️ **不檢測鷹架層級變動之後的樹**：實測發現同一份程式在
 *   「剛同步完」與「重開還原後」看到的樹**不一樣**（L0 會把 `main` 剝掉），
 *   而那是既有行為、與這一刀無關。所以這支**先把狀態跑穩再量**。
 */
import { test, expect } from '@playwright/test'
import { showFlowSlot, appKeepingStorage, typeAndFormat } from './helpers'

type Pos = { id: string; x: number; y: number }

const coords = (page: import('@playwright/test').Page): Promise<string[]> =>
  page.evaluate(() =>
    (window as never as { __app: { flowPanel: { boxPositions(): Pos[] } } })
      .__app.flowPanel.boxPositions()
      .map((p) => `${Math.round(p.x)},${Math.round(p.y)}`))

const dragAllAndSave = (page: import('@playwright/test').Page): Promise<void> =>
  page.evaluate(() => {
    const a = (window as never as { __app: {
      flowPanel: { boxPositions(): Pos[]; moveNode(id: string, dx: number, dy: number): void }
      autoSave(): void
    } }).__app
    a.flowPanel.boxPositions().forEach((p, i) => a.flowPanel.moveNode(p.id, 23 * (i + 1), 17 * (i + 1)))
    a.autoSave()
  })

const openFlow = async (page: import('@playwright/test').Page): Promise<void> => {
  await showFlowSlot(page)
  await expect(page.locator('.flow-toolbox')).toBeVisible({ timeout: 10_000 })
}

/**
 * 重新整理之後**等到樹真的回來**再量。
 *
 * ⚠️ 第一版沒有這一步，於是它在還原完成之前就量了——`boxPositions()` 回**空陣列**，
 * 而失敗訊息說「位置沒回來」。**那句話是對的，而原因是測試自己太早問。**
 *
 * > **一個在被測的東西還沒到場時就量的測試，
 * > report 的是自己的時序，不是那個東西。**
 */
const reloadAndOpenFlow = async (page: import('@playwright/test').Page): Promise<void> => {
  await page.reload()
  await page.waitForFunction(
    () => Boolean((window as never as { __app?: { flowPanel?: unknown } }).__app?.flowPanel),
    undefined, { timeout: 30_000 },
  )
  await openFlow(page)
  await expect
    .poll(async () => (await coords(page)).length, {
      timeout: 20_000,
      message: '🔴 還原之後流程圖是空的 —— 樹沒有回來（這不是佈局的問題）',
    })
    .toBeGreaterThan(0)
}

test('★ 手拖 → 重新整理 → 每一顆都在原位', async ({ page }) => {
  // ⚠️ **不能用 `freshApp`**：它的 `addInitScript` 每次載入都清 localStorage，
  //    包括 `page.reload()`——那會讓這支測試自己把要驗的東西清掉。
  await appKeepingStorage(page)
  await typeAndFormat(page, 'int main() { int x = 1; int y = 2; int z = 3; return 0; }')
  await openFlow(page)

  // ★ 入口條件：錨在**節點數**（合成量），量不到的話下面在比空陣列
  const settled = await coords(page)
  expect(settled.length, '🔴 一顆節點都沒有 → 這支測的不是那條路').toBeGreaterThan(3)

  await dragAllAndSave(page)
  const dragged = await coords(page)
  expect(dragged, '🔴 拖了而位置沒變').not.toEqual(settled)

  // ★ 存下來的要是【鑰匙】不是 nodeId——存 id 等於存一份下次讀不懂的東西
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('semorphe-state') ?? '{}') as
      { version: number; flowLayout?: { keys: string[] }[] })
  expect(saved.flowLayout?.length, '🔴 存檔裡沒有佈局').toBe(dragged.length)
  expect(
    saved.flowLayout?.[0]?.keys?.join('|'),
    '🔴 存的看起來像 nodeId —— 那個東西重開之後一個都不會留',
  ).not.toMatch(/node_\d+_/)

  await reloadAndOpenFlow(page)
  await expect
    .poll(() => coords(page), {
      timeout: 10_000,
      message: '🔴 重新整理之後位置沒回來 —— 鑰匙對不上，或還原掛在錯的時機',
    })
    .toEqual(dragged)
})

test('★ 把 flowLayout 那一格刪掉 → 自動排版，【不是壞掉】', async ({ page }) => {
  // `vision.md` 的驗收條款逐字：「**side-car 刪掉 ＝ 自動排版**（不是壞掉）」，
  // 它從 `concepts/投影.md` 的「排版屬於投影，不屬於真實」推下來。
  //
  // 🔴 而「壞掉」有兩種，兩種都要擋：節點不見了、**程式碼被抹掉**。
  //    後者有前科：2026-08-24 同一族的還原路徑讓 413 字的程式當場消失。
  // ⚠️ **不能用 `freshApp`**：它的 `addInitScript` 每次載入都清 localStorage，
  //    包括 `page.reload()`——那會讓這支測試自己把要驗的東西清掉。
  await appKeepingStorage(page)
  await typeAndFormat(page, 'int main() { int x = 1; int y = 2; int z = 3; return 0; }')
  await openFlow(page)
  const settled = await coords(page)
  expect(settled.length, '入口條件').toBeGreaterThan(3)
  await dragAllAndSave(page)

  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('semorphe-state') ?? '{}') as Record<string, unknown>
    delete raw.flowLayout
    localStorage.setItem('semorphe-state', JSON.stringify(raw))
  })
  await reloadAndOpenFlow(page)

  const after = await coords(page)
  expect(after.length, '🔴 節點不見了 —— 刪掉佈局把圖也弄壞了').toBe(settled.length)
  expect(
    await page.evaluate(() =>
      (window as never as { __app: { flowPanel: { boxPositions(): Pos[] } } })
        .__app.flowPanel.boxPositions().length > 0
      && (window as never as { __app: { codeView: { getCode(): string } } }).__app.codeView.getCode()),
    '🔴 程式碼被抹掉了 —— 那是「從投影重建真相」那條路的老毛病',
  ).toContain('int x = 1')
  await expect(
    page.locator('#flow-panel .flow-notice'),
    '🔴 沒有佈局是正常狀態，不得跳警告',
  ).toHaveCount(0)
})
