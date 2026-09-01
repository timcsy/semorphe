/**
 * **每個槽自己選視圖，而復原不屬於任何一個槽**（spec 169）。
 *
 * ## 它從哪來
 *
 * 使用者 2026-09-01：「我覺得現在工具列的邏輯有點怪怪的，**為何復原按鈕只跟積木**？
 * 然後我希望**每個面板可以去選擇要哪一種視圖**」。
 *
 * ## ⚠️ 為什麼一定要 e2e
 *
 * 「↩↪ 住在哪一格裡面」與「每個槽的分頁列選項一不一樣」都是**畫面上的事實**，
 * 而 happy-dom 沒有版面引擎。
 */
import { test, expect } from '@playwright/test'
import { freshApp } from './helpers'

type P = import('@playwright/test').Page

const pick = async (page: P, id: string): Promise<void> => {
  await page.locator('#status-controls .status-item-btn[data-control-id="layout"]').click()
  await page.locator(`.quick-pick-item[data-value="${id}"]`).click()
  await expect(page.locator('.quick-pick-overlay')).toHaveCount(0)
  await page.waitForFunction((v) => document.body.getAttribute('data-layout') === v, id)
}

const ALL = ['focus', 'compare', 'three-column', 'grid']

test('★ 入口條件：四個版面都套得起來，而槽真的建出來了', () => {
  // 錨在合成量，見 spec 169 的 SC——不錨在「有幾個不對」
  expect(ALL.length).toBe(4)
})

test('🔴 ↩↪ 在四個版面都看得見，而且【不住在任何一格投影裡】', async ({ page }) => {
  // 🔴 `doUndo` 早就問 `lastEditor` 走三條路——行為是全域的。
  //    而在此之前它的位置在積木那一欄的快速列裡，會跟著那一欄一起消失。
  //
  // > **一個動作如果對三個視圖都成立，它就不該住在其中一個視圖裡。**
  await freshApp(page)
  for (const id of ALL) {
    await pick(page, id)
    const s = await page.evaluate(() => {
      const u = document.getElementById('undo-group')
      return {
        visible: !!u && u.getClientRects().length > 0,
        inside: u?.closest('#code-column,#flow-column,#blocks-column,#bottom-container')?.id ?? null,
      }
    })
    expect(s.visible, `🔴 「${id}」裡看不到 ↩↪`).toBe(true)
    expect(s.inside, `🔴 「${id}」裡 ↩↪ 住在 ${s.inside} 裡面——它是全域的動作`).toBeNull()
  }
})

test('🔴 每一個可見槽的【選項集合完全相同】', async ({ page }) => {
  // > **分頁不是問題，不對稱的分頁才是。**
  //
  // ⚠️ 改成下拉之後選項**開了才在 DOM 裡**（2026-09-01 使用者：「我希望不是用 tab，
  //    而是用下拉式」）——所以這一支要**一格一格打開來比**，而不是掃 DOM。
  await freshApp(page)
  await pick(page, 'grid')   // 四個槽都看得見的那一張
  const pickers = page.locator('.slot-picker')
  const n = await pickers.count()
  expect(n, '🔴 一顆選擇器都沒有').toBe(4)

  const sets: string[] = []
  for (let i = 0; i < n; i++) {
    await pickers.nth(i).click()
    await expect(page.locator('.quick-pick-overlay')).toHaveCount(1)
    sets.push(await page.evaluate(() =>
      [...document.querySelectorAll('.quick-pick-overlay .quick-pick-item')]
        .map((e) => (e as HTMLElement).dataset.value).sort().join(',')))
    await page.keyboard.press('Escape')
    await expect(page.locator('.quick-pick-overlay')).toHaveCount(0)
  }
  expect(new Set(sets).size, `🔴 各槽的選項不一樣：${JSON.stringify(sets)}`).toBe(1)
})

test('🔴 換一個槽的視圖，其餘格子的位置與大小【位移為 0】', async ({ page }) => {
  await freshApp(page)
  // 🔴 **比的是「版面的格子」，不是「每個容器的框」**（2026-09-01 修）。
  //
  //    換視圖時容器本來就會**互換位子**——積木讓出右邊那一格、流程住進去。
  //    第一版逐個容器比，於是它抓到的是**這一刀的正常行為**，不是缺陷。
  //
  // > **一條「什麼都不該變」的斷言，要先說清楚【什麼】不該變
  // > ——否則它會把功能本身判成 bug。**
  const boxes = (): Promise<string[]> => page.evaluate(() =>
    ['code-column', 'blocks-column', 'flow-column', 'bottom-container']
      .map((id) => document.getElementById(id))
      .filter((e): e is HTMLElement => !!e && getComputedStyle(e).display !== 'none')
      .map((e) => {
        const b = e.getBoundingClientRect()
        return `${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}x${Math.round(b.height)}`
      }).sort())
  const before = await boxes()
  // 在「對照」把顯示積木的那一格改成流程
  await page.locator('.slot-picker[data-layer="space"]').first().click()
  await page.locator('.quick-pick-item[data-value="relation"]').click()
  await expect(page.locator('.quick-pick-overlay')).toHaveCount(0)
  await page.waitForTimeout(800)
  expect(
    await page.evaluate(() => document.querySelector('.slot-picker[data-layer="relation"]') !== null),
    '🔴 換完之後沒有任何一格顯示流程',
  ).toBe(true)
  expect(await boxes(), '🔴 換視圖動到了格子的位置或大小——那是版面的事，不是內容的事')
    .toEqual(before)
})

test('🔴 切走版面再切回來，指派不變（SC-005）', async ({ page }) => {
  // 🟢 這一條在**置換**的設計下幾乎是免費的：那張表是「層 → 層」，
  //    與版面無關——所以切版面不會弄丟它。
  //    ⚠️ 而如果當初用「槽索引 → 層」，切版面就等於資料遺失。
  await freshApp(page)
  await page.locator('.slot-picker[data-layer="space"]').first().click()
  await page.locator('.quick-pick-item[data-value="relation"]').click()
  await expect(page.locator('.quick-pick-overlay')).toHaveCount(0)
  await page.waitForTimeout(600)

  const shownIn = (): Promise<string[]> => page.evaluate(() =>
    [...document.querySelectorAll('.slot-picker')]
      .filter((b) => (b as HTMLElement).getClientRects().length > 0)
      .map((b) => (b as HTMLElement).dataset.layer!).sort())
  const before = await shownIn()
  expect(before, '🔴 換完之後流程沒有出現在任何一格').toContain('relation')

  await pick(page, 'three-column')
  await pick(page, 'compare')
  expect(await shownIn(), '🔴 切走再切回來，指派變了').toEqual(before)
})

test('🔴 主控台永遠叫得回來（SC-004）', async ({ page }) => {
  // 🟢 由**結構**保證：每一格的下拉都列著全部四層，所以不管現在誰在哪，
  //    使用者永遠選得到主控台。⚠️ 所以**不需要**再加一顆「叫回主控台」的按鈕
  //    ——加了反而讓主控台變成「那個有特權的」。
  await freshApp(page)
  await pick(page, 'compare')
  // 把主控台換走
  await page.locator('.slot-picker[data-layer="state"]').first().click()
  await page.locator('.quick-pick-item[data-value="element"]').click()
  await expect(page.locator('.quick-pick-overlay')).toHaveCount(0)
  await page.waitForTimeout(600)
  // 從任何一格都叫得回來
  await page.locator('.slot-picker:visible').first().click()
  await expect(page.locator('.quick-pick-item[data-value="state"]'),
    '🔴 下拉裡沒有主控台 → 它叫不回來了').toHaveCount(1)
  await page.locator('.quick-pick-item[data-value="state"]').click()
  await expect(page.locator('.quick-pick-overlay')).toHaveCount(0)
  await page.waitForTimeout(600)
  expect(
    await page.evaluate(() => [...document.querySelectorAll('.slot-picker')]
      .some((b) => (b as HTMLElement).dataset.layer === 'state'
        && (b as HTMLElement).getClientRects().length > 0)),
    '🔴 主控台叫不回來',
  ).toBe(true)
})
