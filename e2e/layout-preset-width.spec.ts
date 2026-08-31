/**
 * **切過版面之後，那一欄還佔得到它該佔的寬度。**
 *
 * ## 它從哪來（2026-08-27，使用者截圖）
 *
 * 使用者逐字：「現在這版面有問題」。畫面上程式碼欄佔了一大半，
 * 積木欄縮成一條，而視窗右邊**一大片黑**。
 *
 * 量出來的：`editors` 2000px、`split-right` **213px**。
 *
 * ```
 * SplitPane 用 inline `width: calc(50% - 2px)` 表示比例
 * applyLayout 為了還原「專注」動過的寬度，寫了 blocksColumn.style.width = ''
 * 🔴 而 blocksColumn 【就是】 splitPane.getRightPanel()
 * → 那一欄退回 `flex: 0 1 auto`，縮成【內容寬度】
 * ```
 *
 * > **兩個地方寫同一個 inline 樣式，後寫的那個不知道自己在覆蓋一份狀態。**
 *
 * ## ⚠️ 為什麼單元測試抓不到
 *
 * 這是**版面**——happy-dom 沒有版面引擎，`getBoundingClientRect()` 一律回 0。
 * 全套 5847 支單元測試在這個缺陷存在時**全綠**。
 *
 * ## ⚠️ 而它也不會出現在切換的當下
 *
 * 預設就是「對照」，所以一開機看起來是對的。**要進過專注（或三欄）再切回來**
 * 才看得到——所以下面那條路徑要照順序走完，不能只按最後一顆。
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測拖分隔線之後的比例**——那條路本來就會呼叫 `applyRatio`
 * - **不檢測流程欄的寬度**——它與積木欄共用同一個容器，一個對了另一個就對
 */
import { test, expect } from '@playwright/test'
import { freshApp } from './helpers'

/**
 * ⚠️ **用 `data-value` 選，不用文字**（2026-09-01 改）。
 *
 * 原本是 `.filter({ hasText: /^專注/ })`，而版面選單加上**示意圖**之後那一列的文字
 * 是「積木主控台專注（一次一個）」——`^` 的錨點對不上了。
 *
 * 🟢 而 quick-pick 早就備好了這個把手，它自己的註解逐字寫著：
 * 「給測試選得到的把手：標籤會隨語系換，而值不會」。
 *
 * > **一個用畫面文字定位的測試，會在畫面多一個東西的時候壞掉
 * > ——而那個東西可能完全正確。**
 */
const pick = async (page: import('@playwright/test').Page, id: string): Promise<void> => {
  await page.locator('#status-controls .status-item-btn[data-control-id="layout"]').click()
  await page.locator(`.quick-pick-item[data-value="${id}"]`).click()
  await expect(page.locator('.quick-pick-overlay')).toHaveCount(0)
}

const blocksWidth = (page: import('@playwright/test').Page): Promise<number> =>
  page.evaluate(() => document.querySelector('#blockly-panel')!.getBoundingClientRect().width)

test('★ 專注 → 對照，積木欄要拿回它那一半（不是縮成內容寬度）', async ({ page }) => {
  await freshApp(page)
  const viewport = await page.evaluate(() => window.innerWidth)

  // ★ 入口條件：錨在**視窗寬度**（合成量）——它不會因為缺陷被修好而變小。
  //   視窗量不到的話下面每一個比較都在比 0。
  expect(viewport, '🔴 量不到視窗寬度 → 下面的斷言在比 0').toBeGreaterThan(600)

  const before = await blocksWidth(page)
  expect(before, '🔴 一開機積木欄就是 0 → 這支測的不是那條路').toBeGreaterThan(100)

  await pick(page, 'focus')
  await pick(page, 'compare')

  const after = await blocksWidth(page)
  expect(
    after,
    `🔴 切回對照之後積木欄只有 ${Math.round(after)}px（視窗 ${viewport}px）——` +
      `它退回 \`flex: 0 1 auto\` 縮成內容寬度了。` +
      `\n⚠️ 比例住在容器的 \`grid-template-columns\` 上——面板自己不寫寬度。`,
  ).toBeGreaterThan(viewport * 0.25)

  // ★ 而它要**回到原來那個值**，不是「大於某個門檻就算過」
  expect(Math.abs(after - before), '切回來的寬度與原本不同 → 比例沒有被還原').toBeLessThan(4)
})

test('★ 三欄 → 對照，同一條路', async ({ page }) => {
  // ⚠️ 三欄與專注在 grid 之下走的是同一條路（重設軌道），
  //    而它們**曾經**是兩個不同的分支——留著兩條是因為那一天的缺陷只出現在其中一條。
  await freshApp(page)
  const before = await blocksWidth(page)
  await pick(page, 'three-column')
  await pick(page, 'compare')
  const after = await blocksWidth(page)
  expect(Math.abs(after - before), '三欄切回對照之後寬度沒還原').toBeLessThan(4)
})
