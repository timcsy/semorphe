/**
 * **第九十二條護欄**：手機上每一個視圖都按得到「還原」。
 *
 * ## 它從哪來
 *
 * 使用者 2026-08-31：「手機沒有每個視圖都顯示還原按鈕」。實測：
 *
 * ```
 * 程式碼分頁  ↩↪ 0x0      ← 看不到
 * 積木分頁    ↩↪ 27x22    ✅
 * 流程分頁    ↩↪ 0x0      ← 看不到
 * ```
 *
 * 原因：`switchToMobile` 把**整條快速列**搬進 `mobileBlocksContainer`，
 * 而 ↩↪ 是它的一員。
 *
 * > **一顆全域的按鈕，住在一個會被分頁藏起來的容器裡，
 * > 就只是那個分頁的按鈕。**
 *
 * ## 🔴 而「在別的分頁再放一對」是錯的解法
 *
 * 使用者 2026-08-30 才要求把**三對**還原鈕合併成一對（程式碼工具列／
 * 快速列／流程工具列各一對，而它們會各自還原各自的東西）。所以這支
 * **同時釘住兩個方向**：
 *
 * ```
 * ① 每個分頁都看得到     ← 這一次要修的
 * ② 而全畫面【只有一對】  ← 上一次修的，不准被這一次撞掉
 * ```
 *
 * 少了 ②，「每個分頁各放一對」會讓 ① 變綠，而那正是上一刀刪掉的東西。
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果分頁列上的分頁數少於 3，代表行動版版面沒有生效，這份結果不算數
 * > ——不是「每個視圖都有還原鈕」。**
 *
 * 錨在**分頁數**（合成量：`mobile-tab-bar` 宣告了幾個分頁）。它不會因為
 * 這個缺陷被修好而變動。🔴 **刻意不錨在「看不到的分頁數」**——那是要推向零的。
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測按下去還原了什麼**——`undo-one-pair.spec.ts` 管那個
 * - **不檢測桌面版的位置**（下面第二支管「切回去有沒有放回原位」）
 * - ⚠️ **不檢測沒有標頭的宿主**（VSCode 面板）：那時 ↩↪ 留在快速列裡是對的
 */
import { test, expect } from '@playwright/test'
import { freshApp } from './helpers'

const TABS = ['code', 'blocks', 'flow'] as const

test.describe('行動版', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 500, height: 900 } })

  test('★ 手機：每一個分頁都看得到還原鈕，而全畫面只有一對', async ({ page }) => {
    test.setTimeout(90_000)
    await freshApp(page)
    await page.waitForTimeout(3000)

    // ★ 入口條件——錨在合成量，見檔頭的自我否證
    expect(
      await page.locator('[data-tab]').count(),
      '🔴 分頁列上不到 3 個分頁 → 行動版版面沒生效，這份結果不算數。',
    ).toBeGreaterThanOrEqual(3)

    for (const tab of TABS) {
      await page.locator(`[data-tab="${tab}"]`).last().click()
      await page.waitForTimeout(1200)

      const size = await page.evaluate(() => {
        const r = (id: string): { w: number; h: number } => {
          const b = document.getElementById(id)?.getBoundingClientRect()
          return { w: Math.round(b?.width ?? 0), h: Math.round(b?.height ?? 0) }
        }
        return { undo: r('undo-btn'), redo: r('redo-btn') }
      })

      expect(
        size.undo.w * size.undo.h,
        `🔴 「${tab}」分頁上的還原鈕量到 ${size.undo.w}x${size.undo.h} —— 使用者按不到它。` +
          '⚠️ 它多半還在快速列裡，而快速列被關在積木那一格。',
      ).toBeGreaterThan(0)
      expect(
        size.redo.w * size.redo.h,
        `🔴 「${tab}」分頁上的重做鈕量到 ${size.redo.w}x${size.redo.h}`,
      ).toBeGreaterThan(0)
    }

    // 🔴 **反向**：不准靠「每個分頁各放一對」讓上面變綠
    const pairs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button'))
        .filter((b) => (b.textContent ?? '').trim() === '↩').length)
    expect(
      pairs,
      '🔴 畫面上有不只一顆還原鈕——2026-08-30 才把三對合併成一對，' +
        '而「各放一對」會讓它們各自還原各自的東西。搬同一顆，不要複製。',
    ).toBe(1)
  })
})

test('★ 切回桌機時，還原鈕回到快速列裡的原位（不是排到最後）', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 500, height: 900 })
  await freshApp(page)
  await page.waitForTimeout(3000)
  expect(
    await page.evaluate(() => document.getElementById('undo-btn')?.closest('#toolbar') !== null),
    '🔴 手機版時還原鈕不在全域標頭裡 → 這一次量的不是「搬回去」',
  ).toBe(true)

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.waitForTimeout(2000)

  const order = await page.evaluate(() => {
    const bar = document.querySelector('.quick-access-bar')
    if (!bar) return null
    return Array.from(bar.querySelectorAll('button'))
      .map((b) => b.id || (b.textContent ?? '').trim())
  })
  expect(order, '🔴 找不到快速列').not.toBeNull()
  const u = order!.indexOf('undo-btn'), r = order!.indexOf('redo-btn'), c = order!.indexOf('clear-btn')
  expect(u, `🔴 還原鈕沒有回到快速列。實際順序：${JSON.stringify(order)}`).toBeGreaterThanOrEqual(0)
  expect(r, '🔴 重做鈕沒有回到快速列').toBeGreaterThan(u)
  // ⚠️ 只在「清空」存在時比——那顆由登錄表決定建不建
  if (c >= 0) {
    expect(
      c,
      '🔴 還原／重做排到「清空」後面了——appendChild 會把節點放到最後，' +
        `而順序是使用者記得的東西。實際：${JSON.stringify(order)}`,
    ).toBeGreaterThan(r)
  }
})
