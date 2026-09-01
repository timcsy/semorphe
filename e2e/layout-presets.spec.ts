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

test('🔴 從「對照」切到「十字」，【整個左欄】不跳走', async ({ page }) => {
  // 這是使用者那句話的執行機構：切版面時你正在看的東西不會換位子。
  //
  // 🪦 2026-09-01 之前這一支釘的是「程式碼**與積木**不跳走」（那時十字是
  //    `element,space ／ relation,state`）。使用者把十字改成
  //    `element,relation ／ state,space` 之後，保住的是**更大的一塊**：
  //    整個左欄與「對照」逐格相同——只有積木讓位給流程。
  await freshApp(page)
  const a = { code: await boxOf(page, 'code-column'), bottom: await boxOf(page, 'bottom-container') }
  expect(a.code, '🔴 一開機程式碼那一格就不見了 → 這支測的不是那條路').not.toBeNull()

  await pick(page, 'grid')
  const b = { code: await boxOf(page, 'code-column'), bottom: await boxOf(page, 'bottom-container') }

  expect({ x: b.code!.x, y: b.code!.y }, '🔴 程式碼跳走了').toEqual({ x: a.code!.x, y: a.code!.y })
  expect(b.bottom!.x, '🔴 主控台換了欄').toBe(a.bottom!.x)
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

test('🔴 十字：左上程式碼·右上流程·右下積木·左下主控台', async ({ page }) => {
  await freshApp(page)
  await pick(page, 'grid')
  const [code, flow, blocks, bottom] = await Promise.all(
    ['code-column', 'flow-column', 'blocks-column', 'bottom-container'].map((id) => boxOf(page, id)))
  expect([code, flow, blocks, bottom].every((b) => b !== null), '🔴 十字裡有格子不見了').toBe(true)
  // 左行 ＝ 程式碼／主控台　右行 ＝ 流程／積木
  expect(code!.x, '🔴 程式碼不在左').toBeLessThan(flow!.x)
  expect(bottom!.x, '🔴 主控台不在左下').toBe(code!.x)
  expect(blocks!.x, '🔴 積木不在右下').toBe(flow!.x)
  expect(bottom!.y, '🔴 主控台不在下排').toBeGreaterThan(code!.y)
  expect(blocks!.y, '🔴 積木不在下排').toBeGreaterThan(flow!.y)
})

test('🔴 格與格之間要有【縫】，而把手剛好蓋住那條縫——不壓到內容', async ({ page }) => {
  // 🔴 使用者 2026-09-01：「grid 邊界要處理一下」。第一版沒有 gap，
  //    兩欄貼在一起，而把手是一層 4px 的浮層——它壓掉每一欄各 2px。
  await freshApp(page)
  const gap = await page.evaluate(() =>
    parseFloat(getComputedStyle(document.getElementById('editors')!).columnGap) || 0)
  expect(gap, '🔴 沒有縫 → 把手只能蓋在內容上').toBeGreaterThan(0)

  const code = (await boxOf(page, 'code-column'))!
  const blocks = (await boxOf(page, 'blocks-column'))!
  expect(blocks.x - (code.x + code.w), '🔴 兩欄之間的距離不等於那條縫').toBe(gap)
})

test('🔴 分隔線的長度 ＝ 那條縫【真正存在】的長度——不得穿過跨格的格子', async ({ page }) => {
  // 🔴 使用者 2026-09-01：「那條水平線還是沒有處理好」。
  //    在「對照」裡積木是**跨兩列**的，它上面根本沒有縫——而第一版的橫線
  //    橫跨整個容器，從積木中間穿過去。
  //
  // > **一條分隔線的長度，等於那條縫真正存在的長度
  // > ——而跨格的地方，縫是不存在的。**
  await freshApp(page)
  const seam = await page.evaluate(() => {
    const h = [...document.querySelectorAll('.grid-divider-rows')][0] as HTMLElement | undefined
    const code = document.getElementById('code-column')!.getBoundingClientRect()
    return h ? { right: parseFloat(h.style.left) + parseFloat(h.style.width), codeRight: Math.round(code.width) } : null
  })
  expect(seam, '🔴 「對照」裡沒有橫的分隔線 → 這支測的不是那條路').not.toBeNull()
  expect(seam!.right, '🔴 橫線穿過了積木——而積木在「對照」跨兩列，那裡沒有縫')
    .toBeLessThanOrEqual(seam!.codeRight + 1)
})

test('🔴 分頁收起來時，它後面那一槓也要跟著收', async ({ page }) => {
  // 🔴 使用者 2026-09-01：「這槓有點怪」——只收按鈕的話會留下一條前面什麼都沒有的豎線。
  //
  // > **一個分隔用的東西，在它兩邊有一邊消失的時候，也要跟著消失。**
  await freshApp(page)
  const barItems = (): Promise<string[]> => page.evaluate(() =>
    [...document.querySelector('.quick-access-bar')!.children]
      .filter((e) => getComputedStyle(e).display !== 'none')
      .map((e) => e.id || e.className))
  expect(await barItems(), '🔴 「對照」裡那一組分頁與它的槓都要在')
    .toEqual(expect.arrayContaining(['view-tabs', 'toolbar-separator']))
  await pick(page, 'three-column')
  const after = await barItems()
  expect(after, '🔴 分頁沒收起來').not.toContain('view-tabs')
  expect(after, '🔴 槓留在原地了——它前面什麼都沒有').not.toContain('toolbar-separator')
})

test('🔴 兩個投影都看得見時，「積木／流程」那兩顆分頁不該還在', async ({ page }) => {
  // > **一個控制項如果在某個狀態下什麼都不做，那個狀態下它就不該在。**
  await freshApp(page)
  // ⚠️ **問「畫得出來嗎」，不問 `display`**：收起來的是外面那一組（`#view-tabs`），
  //    而 `getComputedStyle` 對一個藏起來的祖先的子孫，回的仍然是它自己指定的值。
  //
  // > **`display` 是一個元素自己說的話，而「看不看得到」是它整條祖先鏈說的。**
  const tabsVisible = (): Promise<boolean[]> => page.evaluate(() =>
    ['view-blocks-btn', 'view-flow-btn'].map((id) => {
      const e = document.getElementById(id)
      return !!e && e.getClientRects().length > 0
    }))
  expect(await tabsVisible(), '🔴 「對照」只放得下一個投影，那兩顆要在').toEqual([true, true])
  await pick(page, 'three-column')
  expect(await tabsVisible(), '🔴 三欄兩個都在，那兩顆按了沒反應').toEqual([false, false])
  await pick(page, 'grid')
  expect(await tabsVisible(), '🔴 十字兩個都在，那兩顆按了沒反應').toEqual([false, false])
  await pick(page, 'compare')
  expect(await tabsVisible(), '🔴 切回對照之後那兩顆要回來').toEqual([true, true])
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
