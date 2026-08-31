/**
 * **四張版面示意圖，而沒有任何一層是特別的**（spec 168）。
 *
 * ## 它從哪來
 *
 * 使用者 2026-08-31 逐字：「你現在把積木和流程用 tab 切換我不太喜歡，
 * **因為這樣程式碼面板就變得比較特別了**」。
 *
 * ## ⚠️ 為什麼一定要 e2e
 *
 * 這是**版面**——happy-dom 沒有版面引擎，`getBoundingClientRect()` 一律回 0。
 * 「格子在哪、多大」這件事**單元測試量不到**（`layout-preset-width.spec.ts` 記過同一件事）。
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測示意圖好不好看**——只檢測它的格數與跨度與宣告一致。
 * - **不檢測拖分隔線之後的比例**——那是 `layout-preset-width.spec.ts` 的事。
 * - **不檢測行動版**——行動版是單槽，spec 明文不做。
 */
import { test, expect } from '@playwright/test'
import { freshApp } from './helpers'

type P = import('@playwright/test').Page

const openPicker = async (page: P): Promise<void> => {
  await page.locator('#status-controls .status-item-btn[data-control-id="layout"]').click()
  await expect(page.locator('.quick-pick-overlay')).toHaveCount(1)
}

const pick = async (page: P, id: string): Promise<void> => {
  await openPicker(page)
  await page.locator(`.quick-pick-item[data-value="${id}"]`).click()
  await expect(page.locator('.quick-pick-overlay')).toHaveCount(0)
  await page.waitForFunction((v) => document.body.getAttribute('data-layout') === v, id)
}

const boxOf = (page: P, id: string): Promise<{ x: number; y: number; w: number; h: number } | null> =>
  page.evaluate((elId) => {
    const el = document.getElementById(elId)
    if (!el || getComputedStyle(el).display === 'none') return null
    const b = el.getBoundingClientRect()
    return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }
  }, id)

test('★ 入口條件：編輯區真的是一張 grid，而四格都建出來了', async ({ page }) => {
  // 錨在**合成量**（是不是 grid、建了幾個容器），不是「有幾個位置對」
  // ——後者會在這支成功的那天變紅。
  await freshApp(page)
  const s = await page.evaluate(() => ({
    display: getComputedStyle(document.getElementById('editors')!).display,
    cells: ['code-column', 'blocks-column', 'flow-column', 'bottom-container']
      .filter((id) => document.getElementById(id)).length,
  }))
  expect(s.display, '🔴 編輯區不是 grid → 下面每一個座標都不算數').toBe('grid')
  expect(s.cells, '🔴 四格沒有全部建出來 → 下面的「不見了」可能只是沒建').toBe(4)
})

test('🔴 從「對照」切到「十字」，程式碼與積木【不跳走】', async ({ page }) => {
  // 這是使用者那句話的執行機構：切版面時你正在看的東西不會換位子。
  // ⚠️ 大小**會**變（積木在對照跨兩列、在十字佔一格）——要保證的是【左上角】。
  await freshApp(page)
  const a = { code: await boxOf(page, 'code-column'), blocks: await boxOf(page, 'blocks-column') }
  expect(a.code, '🔴 一開機程式碼那一格就不見了 → 這支測的不是那條路').not.toBeNull()

  await pick(page, 'grid')
  const b = { code: await boxOf(page, 'code-column'), blocks: await boxOf(page, 'blocks-column') }

  expect({ x: b.code!.x, y: b.code!.y }, '🔴 程式碼跳走了').toEqual({ x: a.code!.x, y: a.code!.y })
  expect({ x: b.blocks!.x, y: b.blocks!.y }, '🔴 積木跳走了').toEqual({ x: a.blocks!.x, y: a.blocks!.y })
})

test('🔴 十字：四格【等大】——「沒有任何一層是特別的」是可量的', async ({ page }) => {
  await freshApp(page)
  await pick(page, 'grid')
  const boxes = await Promise.all(
    ['code-column', 'blocks-column', 'flow-column', 'bottom-container'].map((id) => boxOf(page, id)))
  expect(boxes.every((b) => b !== null), '🔴 十字裡有格子不見了').toBe(true)
  const areas = boxes.map((b) => b!.w * b!.h)
  const max = Math.max(...areas), min = Math.min(...areas)
  // SC-005：面積差在 ±5% 以內
  expect((max - min) / max, `🔴 四格不等大：${areas.join(' / ')}`).toBeLessThan(0.05)
})

test('🔴 四個版面裡，主控台一次都不准不見', async ({ page }) => {
  // 🔴 舊規則寫的是「state 不得出現在編輯區的預設裡」，理由是怕面板區被佈局關掉。
  //    版面可以**搬**它，**不得關掉**它——所以判準要反過來寫。
  await freshApp(page)
  for (const id of ['focus', 'compare', 'three-column', 'grid']) {
    await pick(page, id)
    expect(await boxOf(page, 'bottom-container'), `🔴 「${id}」把主控台弄不見了`).not.toBeNull()
  }
})

test('🔴 十字的主控台在【右下】，不是底部橫幅', async ({ page }) => {
  await freshApp(page)
  await pick(page, 'grid')
  const b = (await boxOf(page, 'bottom-container'))!
  const blocks = (await boxOf(page, 'blocks-column'))!
  expect(b.x, '🔴 主控台還在左邊 → 它不是右下那一格').toBe(blocks.x)
  expect(b.y, '🔴 主控台還在上面').toBeGreaterThan(blocks.y)
})

test('🔴 選單裡有四張【示意圖】，而每張的格數與宣告一致', async ({ page }) => {
  await freshApp(page)
  await openPicker(page)
  const rows = await page.evaluate(() =>
    [...document.querySelectorAll('.quick-pick-overlay .quick-pick-item')].map((r) => ({
      id: (r as HTMLElement).dataset.value,
      cells: r.querySelectorAll('.quick-pick-preview-cell').length,
      visible: (r.querySelector('.quick-pick-preview') as HTMLElement | null)?.getBoundingClientRect().width ?? 0,
    })))
  expect(rows.map((r) => r.id)).toEqual(['focus', 'compare', 'three-column', 'grid'])
  // 跨格算【一格】——`compare` 的積木跨兩列，所以是 3 格不是 4 格
  expect(rows.map((r) => r.cells), '🔴 圖的格數與宣告不一致').toEqual([2, 3, 4, 4])
  expect(rows.every((r) => r.visible > 0), '🔴 圖畫出來是 0 寬 → 使用者看不到').toBe(true)
})
