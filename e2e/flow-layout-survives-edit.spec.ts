/**
 * **手拖的佈局要活得過一次編輯。**
 *
 * ## 它從哪來
 *
 * 路線圖把這件事寫成開放問句（`vision.md`「**nodeId 穩不穩定**——不穩就對不回去」）。
 * 2026-08-27 量出來：**改一行不相干的程式碼，id 相同數 0**
 * ——`generateId()` 是 `node_${++counter}_${Date.now()}`，兩個都會變。
 *
 * 🔴 而它不是「還沒持久化」，是**今天就在掉東西**：
 * 面板的 `rebuild()` 刪掉不在新樹裡的位置，而重新解析後沒有一個 id 還在。
 *
 * > **使用者手拖十顆節點，在程式碼裡打一個字，十顆全部跳回自動排版的位置。**
 *
 * ## ⚠️ 為什麼這一支要在瀏覽器裡跑
 *
 * 位置是**版面**——happy-dom 沒有版面引擎。而配對邏輯本身由
 * `tests/unit/core/flow-layout-key.test.ts` 釘（那一支抓到了這一支抓不到的東西：
 * **配到別人身上時，畫面上的座標字串照樣都在**）。
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測重開瀏覽器之後還在**——那是持久化，是下一刀（`ViewState` 的 key）
 * - **不檢測配對是不是配對到【對的那一顆】**——那由單元測試釘
 */
import { test, expect } from '@playwright/test'
import { showFlowSlot, freshApp, typeAndFormat } from './helpers'

type Pos = { id: string; x: number; y: number }

const positions = (page: import('@playwright/test').Page): Promise<Pos[]> =>
  page.evaluate(() =>
    (window as never as { __app: { flowPanel: { boxPositions(): Pos[] } } })
      .__app.flowPanel.boxPositions())

const dragAll = (page: import('@playwright/test').Page): Promise<void> =>
  page.evaluate(() => {
    const fp = (window as never as {
      __app: { flowPanel: { boxPositions(): Pos[]; moveNode(id: string, dx: number, dy: number): void } }
    }).__app.flowPanel
    fp.boxPositions().forEach((p, i) => fp.moveNode(p.id, 17 * (i + 1), 11 * (i + 1)))
  })

const setCode = (page: import('@playwright/test').Page, code: string): Promise<void> =>
  page.evaluate(async (c) => {
    const a = (window as never as {
      __app: {
        codeView: { setCode(s: string): void; getCode(): string }
        syncController: { syncCodeToBlocks(s: string): Promise<unknown> }
      }
    }).__app
    a.codeView.setCode(c)
    await a.syncController.syncCodeToBlocks(a.codeView.getCode())
  }, code)

const BASE = 'int main() {\n  int x = 1;\n  int y = 2;\n  int z = 3;\n  return 0;\n}'

test('★ 手拖之後在程式碼裡加一行——每一顆都留在原地', async ({ page }) => {
  await freshApp(page)
  await typeAndFormat(page, 'int main() { int x = 1; int y = 2; int z = 3; return 0; }')
  await showFlowSlot(page)
  await expect(page.locator('.flow-toolbox')).toBeVisible({ timeout: 10_000 })

  await setCode(page, BASE)
  await page.waitForTimeout(600)

  // ★ 入口條件——錨在**節點數**（合成量：這段程式有幾顆），
  //   它不會因為佈局保得住而變小。量不到的話下面在比空陣列。
  const before = await positions(page)
  expect(before.length, '🔴 一顆節點都沒有 → 這支測的不是那條路').toBeGreaterThan(5)

  await dragAll(page)
  const dragged = await positions(page)
  const coords = (ps: Pos[]): string[] => ps.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`)
  expect(
    coords(dragged).sort(),
    '🔴 拖了而位置沒變 → `moveNode` 沒有寫進面板私有狀態',
  ).not.toEqual(coords(before).sort())

  await setCode(page, BASE.replace('  return 0;', '  int w = 4;\n  return 0;'))
  await page.waitForTimeout(800)

  const after = await positions(page)
  const kept = coords(dragged).filter((c) => coords(after).includes(c)).length
  expect(
    kept,
    `🔴 手拖 ${dragged.length} 顆，加一行之後只剩 ${kept} 顆在原地。\n` +
      `⚠️ nodeId 每次重新解析都會換，所以佈局的鑰匙【不能是 nodeId】` +
      `（見 core/flow/layout-key.ts）。`,
  ).toBe(dragged.length)
})

test('★ 刪掉一行——其餘的不動，而【不得】誤報「對不回位置」', async ({ page }) => {
  // 🔴 第一版在刪除時會報「有 2 顆對不回原本的位置」——**而它們是被刪掉的**。
  //
  // > **一條在正常操作下也會響的警告，會被訓練成沒有人看
  // > ——而那時它報的真問題也一起被忽略了。**
  await freshApp(page)
  await typeAndFormat(page, 'int main() { int x = 1; int y = 2; int z = 3; return 0; }')
  await showFlowSlot(page)
  await expect(page.locator('.flow-toolbox')).toBeVisible({ timeout: 10_000 })

  await setCode(page, BASE)
  await page.waitForTimeout(600)
  await dragAll(page)
  const dragged = await positions(page)
  expect(dragged.length, '入口條件').toBeGreaterThan(5)

  await setCode(page, BASE.replace('  int y = 2;\n', ''))
  await page.waitForTimeout(800)

  const after = await positions(page)
  expect(after.length, '刪了一行而節點沒變少').toBeLessThan(dragged.length)
  const coords = (ps: Pos[]): string[] => ps.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`)
  expect(
    coords(after).filter((c) => coords(dragged).includes(c)).length,
    '🔴 刪一行把其餘節點的位置也弄掉了',
  ).toBe(after.length)
  await expect(
    page.locator('#flow-panel .flow-notice'),
    '🔴 刪除是正常操作，不得跳警告',
  ).toHaveCount(0)
})
